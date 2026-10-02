const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa a API do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gera um artigo usando a inteligência artificial (Gemini)
 * @param {string} tema O tema do artigo
 * @returns {Promise<{titulo: string, conteudo: string}>}
 */
async function gerarArtigo(tema) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `
Você é um redator profissional de artigos para a web, com foco em SEO.
Escreva um artigo completo sobre o tema: "${tema}".

O retorno DEVE estar EXATAMENTE no formato Markdown (MD/MDX).
Siga esta estrutura:
1. Comece com um cabeçalho frontmatter YAML contendo title, date e description.
2. Depois, o conteúdo do artigo com Headings (##), parágrafos, e listas se necessário.

Exemplo do formato esperado:
---
title: "Título Chamativo Aqui"
date: "2024-10-02"
description: "Uma breve descrição para SEO."
---

Aqui começa o artigo...
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textoGerado = response.text();

        return {
            conteudo: textoGerado,
            temaOriginal: tema
        };
    } catch (error) {
        console.error("Erro ao gerar artigo:", error);
        throw error;
    }
}

module.exports = { gerarArtigo };
