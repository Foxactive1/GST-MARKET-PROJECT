import json
import unittest
from unittest.mock import MagicMock, patch

from werkzeug.security import generate_password_hash

from backend import create_app, db
from backend.models import Store, User


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "JWT_SECRET_KEY": "test-jwt-secret",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()
            store = Store(name="Mercado de Teste")
            db.session.add(store)
            db.session.flush()
            db.session.add(User(
                store_id=store.id,
                username="admin",
                name="Admin",
                password_hash=generate_password_hash("senha-de-teste"),
                role="admin",
            ))
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def _token(self):
        response = self.client.post("/api/auth/login", json={
            "username": "admin", "password": "senha-de-teste"
        })
        self.assertEqual(response.status_code, 200)
        return response.get_json()["access_token"]

    def test_health_checks_database(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["database"], "connected")

    def test_login_rejects_wrong_password(self):
        response = self.client.post("/api/auth/login", json={
            "username": "admin", "password": "errada"
        })
        self.assertEqual(response.status_code, 401)

    def test_price_search_requires_authentication(self):
        response = self.client.get("/api/price-search?q=arroz")
        self.assertEqual(response.status_code, 401)

    def test_price_search_normalizes_marketplace_results(self):
        token = self._token()
        upstream = MagicMock()
        upstream.__enter__.return_value.read.return_value = json.dumps({
            "results": [
                {
                    "id": "MLB123",
                    "title": "Arroz 5kg",
                    "price": 24.9,
                    "seller": {"id": 42},
                    "permalink": "https://produto.mercadolivre.com.br/MLB123",
                    "thumbnail": "https://img.example/arroz.jpg",
                    "currency_id": "BRL",
                },
                {"title": "Produto sem preço", "price": None},
            ]
        }).encode("utf-8")

        with patch("backend.urlopen", return_value=upstream) as mocked:
            response = self.client.get(
                "/api/price-search?q=arroz%205kg",
                headers={"Authorization": f"Bearer {token}"},
            )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["provider"], "Mercado Livre")
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["title"], "Arroz 5kg")
        self.assertEqual(result["results"][0]["seller"]["nickname"], "Vendedor 42")
        self.assertIn("sites/MLB/search", mocked.call_args.args[0].full_url)

    def test_price_search_rejects_empty_query(self):
        token = self._token()
        response = self.client.get(
            "/api/price-search?q= ",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 400)

    def test_state_requires_auth_and_uses_optimistic_version(self):
        self.assertEqual(self.client.get("/api/state").status_code, 401)
        token = self._token()
        headers = {"Authorization": f"Bearer {token}"}
        initial = self.client.get("/api/state", headers=headers).get_json()
        self.assertEqual(initial["version"], 0)
        self.assertIsNone(initial["state"])

        saved = self.client.put("/api/state", headers=headers, json={
            "state": {"clients": [{"id": "c1", "nome": "Ana"}]},
            "version": 0,
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["version"], 1)

        stale = self.client.put("/api/state", headers=headers, json={
            "state": {"clients": []}, "version": 0,
        })
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.get_json()["code"], "VERSION_CONFLICT")
        self.assertEqual(stale.get_json()["state"]["clients"][0]["nome"], "Ana")


if __name__ == "__main__":
    unittest.main()
