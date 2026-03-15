#!/usr/bin/env node

/**
 * DEV RESET TOOL
 * limpa ambiente de desenvolvimento
 * autor: Dione Castro Alves - InNovaIdeia
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("\n🚀 Iniciando limpeza do ambiente...\n");

// diretórios comuns de cache/build
const pastas = [
    "node_modules/.cache",
    ".cache",
    "cache",
    "tmp",
    "temp",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".parcel-cache",
    ".vite"
];

// remover diretórios
function removerPastas() {

    pastas.forEach((pasta) => {

        const dir = path.join(process.cwd(), pasta);

        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
                console.log("🧹 removido:", pasta);
            } catch (err) {
                console.log("⚠️ erro ao remover:", pasta);
            }
        }

    });

}

// limpar localstorage simulado
function limparLocalStorage() {

    const storagePath = path.join(process.cwd(), "scratch");

    if (fs.existsSync(storagePath)) {
        fs.rmSync(storagePath, { recursive: true, force: true });
        console.log("🧹 localStorage (node-localstorage) limpo");
    }

}

// limpar cache do npm
function limparNpmCache(){

    try{
        execSync("npm cache clean --force", { stdio: "inherit" });
    }catch{
        console.log("⚠️ npm cache não pôde ser limpo");
    }

}

// limpar logs
function limparLogs(){

    const logs = path.join(process.cwd(), "logs");

    if(fs.existsSync(logs)){
        fs.rmSync(logs,{recursive:true,force:true})
        console.log("🧹 logs removidos")
    }

}

// execução
function reset(){

    removerPastas()

    limparLocalStorage()

    limparLogs()

    limparNpmCache()

    console.log("\n✅ ambiente de desenvolvimento limpo\n")

}

reset()