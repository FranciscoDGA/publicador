const { Octokit } = require("octokit");

/**
 * Publica o artigo no GitHub
 * @param {string} conteudo O conteúdo do artigo em Markdown
 * @param {string} repoOwner Dono do repositório (seu usuário no GitHub)
 * @param {string} repoName Nome do repositório
 * @param {string} pasta Destino dentro do repositório (ex: 'posts' ou 'content/blog')
 */
async function publicarNoGitHub(conteudo, repoOwner, repoName, pasta) {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Gera um nome de arquivo seguro baseado na data/hora
    const timestamp = Date.now();
    const fileName = `artigo-${timestamp}.mdx`;
    const caminhoCompleto = `${pasta}/${fileName}`;

    try {
        // Encodando o conteúdo em Base64 (requerido pela API do GitHub)
        const conteudoBase64 = Buffer.from(conteudo).toString('base64');

        const response = await octokit.rest.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: caminhoCompleto,
            message: `Publicador Automático: Novo artigo adicionado (${fileName})`,
            content: conteudoBase64,
            branch: "main", // Pode mudar para 'master' dependendo do seu repositório
        });

        return {
            sucesso: true,
            url: response.data.content.html_url,
            commit: response.data.commit.html_url
        };
    } catch (error) {
        console.error("Erro ao publicar no GitHub:", error);
        throw error;
    }
}

module.exports = { publicarNoGitHub };
