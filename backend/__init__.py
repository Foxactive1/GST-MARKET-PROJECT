"""Flask API for GST Market, backed by PostgreSQL/Neon."""
import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def _database_url():
    value = os.getenv("DATABASE_URL", "sqlite:///gst-market-dev.db").strip()
    if value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql+psycopg://", 1)
    elif value.startswith("postgresql://"):
        value = value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY") or ("dev-only-change-me" if os.getenv("FLASK_ENV") != "production" else None),
        SQLALCHEMY_DATABASE_URI=_database_url(),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_recycle": 300},
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or ("dev-only-change-me" if os.getenv("FLASK_ENV") != "production" else None),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=8),
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config.get("SECRET_KEY") or not app.config.get("JWT_SECRET_KEY"):
        raise RuntimeError("Configure SECRET_KEY e JWT_SECRET_KEY no ambiente de produção.")

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    raw_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins or ["http://localhost:8000", "http://127.0.0.1:8000"]}},
         allow_headers=["Content-Type", "Authorization", "If-Match"],
         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])

    from .models import Store, StoreState, User  # register SQLAlchemy models

    @app.get("/api/health")
    def health():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify(status="ok", database="connected"), 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Database health check failed")
            return jsonify(status="unavailable", database="disconnected"), 503

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        if not username or not password:
            return jsonify(error="Informe usuário e senha."), 400
        user = User.query.filter_by(username=username.lower(), active=True).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify(error="Usuário ou senha inválidos."), 401
        token = create_access_token(identity=user.id, additional_claims={"store_id": user.store_id, "role": user.role})
        return jsonify(
            access_token=token,
            user={"id": user.id, "username": user.username, "nome": user.name, "email": user.email,
                  "role": user.role, "store_id": user.store_id},
            expires_in=28800,
        )

    @app.get("/api/auth/me")
    @jwt_required()
    def me():
        user = db.session.get(User, get_jwt_identity())
        if not user or not user.active:
            return jsonify(error="Sessão inválida."), 401
        return jsonify(user={"id": user.id, "username": user.username, "nome": user.name, "email": user.email,
                             "role": user.role, "store_id": user.store_id})

    def current_store_id():
        from flask_jwt_extended import get_jwt
        claims = get_jwt()
        return claims.get("store_id")

    @app.get("/api/state")
    @jwt_required()
    def get_state():
        row = StoreState.query.filter_by(store_id=current_store_id()).first()
        return jsonify(state=row.payload if row else None, version=row.version if row else 0,
                       updated_at=row.updated_at.isoformat() if row else None)

    @app.put("/api/state")
    @jwt_required()
    def put_state():
        body = request.get_json(silent=True) or {}
        payload = body.get("state")
        expected = body.get("version")
        if not isinstance(payload, dict) or not isinstance(expected, int) or expected < 0:
            return jsonify(error="Envie state (objeto) e version (inteiro)."), 400
        store_id = current_store_id()
        row = StoreState.query.filter_by(store_id=store_id).with_for_update().first()
        current_version = row.version if row else 0
        if expected != current_version:
            return jsonify(error="O estado remoto foi alterado em outra sessão.",
                           code="VERSION_CONFLICT", version=current_version,
                           state=row.payload if row else None), 409
        if row:
            row.payload = payload
            row.version += 1
        else:
            row = StoreState(store_id=store_id, payload=payload, version=1)
            db.session.add(row)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("State save failed")
            current = StoreState.query.filter_by(store_id=store_id).first()
            if current and current.version != expected:
                return jsonify(error="O estado remoto foi alterado em outra sessão.",
                               code="VERSION_CONFLICT", version=current.version,
                               state=current.payload), 409
            app.logger.exception("State save failed")
            return jsonify(error="Não foi possível salvar no banco."), 500
        return jsonify(version=row.version, updated_at=row.updated_at.isoformat()), 200

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="O corpo da requisição excede 16 MB."), 413

    @app.errorhandler(500)
    def internal_error(_error):
        db.session.rollback()
        return jsonify(error="Erro interno do servidor."), 500

    @app.cli.command("create-admin")
    def create_admin():
        """Create the first store and administrator from interactive prompts."""
        import getpass
        from sqlalchemy import select
        if db.session.scalar(select(User.id).limit(1)):
            raise SystemExit("Já existe usuário cadastrado. Crie usuários adicionais pelo comando create-user.")
        store_name = input("Nome do mercado: ").strip()
        username = input("Usuário administrador: ").strip().lower()
        name = input("Nome do administrador: ").strip()
        email = input("E-mail (opcional): ").strip() or None
        password = getpass.getpass("Senha (mínimo 12 caracteres): ")
        if not store_name or not username or not name or len(password) < 12:
            raise SystemExit("Mercado, usuário e nome são obrigatórios; senha deve ter ao menos 12 caracteres.")
        store = Store(name=store_name)
        db.session.add(store)
        db.session.flush()
        db.session.add(User(store_id=store.id, username=username, name=name, email=email,
                            password_hash=generate_password_hash(password), role="admin"))
        db.session.commit()
        print("Administrador criado para o mercado:", store.name)

    @app.cli.command("create-user")
    def create_user():
        """Create an operator account for the existing store."""
        import getpass
        from sqlalchemy import select
        store = db.session.scalar(select(Store).order_by(Store.created_at).limit(1))
        if not store:
            raise SystemExit("Crie primeiro o administrador com flask create-admin.")
        username = input("Usuário novo: ").strip().lower()
        name = input("Nome: ").strip()
        email = input("E-mail (opcional): ").strip() or None
        role = input("Perfil [operador/admin] (operador): ").strip().lower() or "operador"
        password = getpass.getpass("Senha (mínimo 12 caracteres): ")
        if role not in ("admin", "operador") or len(password) < 12:
            raise SystemExit("Perfil inválido ou senha menor que 12 caracteres.")
        db.session.add(User(store_id=store.id, username=username, name=name, email=email,
                            password_hash=generate_password_hash(password), role=role))
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise SystemExit("Usuário duplicado ou falha ao salvar.")
        print("Usuário criado:", username)

    return app
