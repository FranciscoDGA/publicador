require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { gerarArtigo } = require('./services/ai');
const { publicarNoGitHub } = require('./services/github');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(token);

// Memória temporária para artigos pendentes
const artigosPendentes = {};

console.log("🤖 Publicador Bot iniciado com sucesso usando Telegraf!");

bot.start((ctx) => {
    const instrucoes = `
👋 Olá! Eu sou o *Publicador Bot*.

Eu te ajudo a gerar e publicar artigos nos seus sites da Vercel.

*Como usar:*
Para criar um artigo, digite:
\`/gerar Seu Tema Aqui\`

Exemplo:
\`/gerar Os benefícios da inteligência artificial no marketing\`
    `;
    ctx.reply(instrucoes, { parse_mode: 'Markdown' });
});

bot.command('gerar', async (ctx) => {
    // Pega o texto depois do /gerar
    const tema = ctx.message.text.replace('/gerar', '').trim();
    
    if (!tema) {
        return ctx.reply("⚠️ Você esqueceu de dizer o tema. Exemplo: /gerar Vantagens do Bitcoin");
    }

    ctx.reply(`⏳ Gerando artigo sobre: *${tema}*...\nIsso pode levar alguns segundos.`, { parse_mode: 'Markdown' });

    try {
        const artigo = await gerarArtigo(tema);
        
        const artigoId = Date.now().toString();
        artigosPendentes[artigoId] = artigo;

        const previa = artigo.conteudo.substring(0, 800) + "\n\n... (cortado para visualização)";

        await ctx.reply(`📝 *Artigo Gerado!* \n\n*Tema:* ${tema}\n\n*Prévia:*\n${previa}\n\nO que deseja fazer?`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Aprovar e Publicar', `aprovar_${artigoId}`)],
                [Markup.button.callback('❌ Rejeitar', `rejeitar_${artigoId}`)]
            ])
        });

    } catch (error) {
        console.error(error);
        ctx.reply("❌ Erro ao gerar o artigo. Verifique os logs.");
    }
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data; // 'aprovar_123'
    const acao = data.split('_')[0];
    const artigoId = data.split('_')[1];

    const artigo = artigosPendentes[artigoId];

    if (!artigo) {
        return ctx.reply("⚠️ Este artigo não está mais na memória (ou o bot foi reiniciado). Gere novamente.");
    }

    if (acao === 'rejeitar') {
        delete artigosPendentes[artigoId];
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        return ctx.reply("🗑️ Artigo *Rejeitado* e descartado.", { parse_mode: 'Markdown' });
    }

    if (acao === 'aprovar') {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.reply("🚀 Publicando artigo no GitHub...");

        try {
            const donoRepo = process.env.GITHUB_REPO_OWNER;
            const nomeRepo = process.env.GITHUB_REPO_NAME || "publicador"; // Fallback
            const pastaPosts = process.env.GITHUB_POSTS_FOLDER || "src/content/blog";
            
            if (!donoRepo) {
                return ctx.reply("⚠️ Erro: Variável GITHUB_REPO_OWNER não configurada.");
            }

            const resultado = await publicarNoGitHub(artigo.conteudo, donoRepo, nomeRepo, pastaPosts);
            
            delete artigosPendentes[artigoId];

            ctx.reply(`✅ *Artigo Publicado com Sucesso!*\n\nO repositório ${nomeRepo} foi atualizado. Se ele estiver na Vercel, o deploy automático já deve começar.\n\n🔗 [Ver arquivo no GitHub](${resultado.url})`, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

        } catch (error) {
            console.error(error);
            ctx.reply(`❌ Erro ao publicar: ${error.message}`);
        }
    }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
