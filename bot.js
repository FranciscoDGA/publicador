require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { gerarArtigo } = require('./services/ai');
const { publicarNoGitHub } = require('./services/github');

// Seu Token recebido do BotFather
const token = process.env.TELEGRAM_BOT_TOKEN;

// Inicia o bot com polling para escutar os comandos e botões continuamente
const bot = new TelegramBot(token, { polling: true });

// Objeto para armazenar artigos na memória temporária aguardando aprovação
const artigosPendentes = {};

console.log("🤖 Publicador Bot iniciado!");

// Comando principal para iniciar a geração
bot.onText(/\/gerar (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tema = match[1];

    bot.sendMessage(chatId, `⏳ Gerando artigo sobre: *${tema}*...\nIsso pode levar alguns segundos.`, { parse_mode: 'Markdown' });

    try {
        const artigo = await gerarArtigo(tema);
        
        // Salva na "memória" com um ID único (usando timestamp)
        const artigoId = Date.now().toString();
        artigosPendentes[artigoId] = artigo;

        const previa = artigo.conteudo.substring(0, 800) + "\n\n... (cortado para visualização)";

        const opcoesBotoes = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Aprovar e Publicar', callback_data: `aprovar_${artigoId}` },
                        { text: '❌ Rejeitar', callback_data: `rejeitar_${artigoId}` }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, `📝 *Artigo Gerado!* \n\n*Tema:* ${tema}\n\n*Prévia:*\n${previa}\n\nO que deseja fazer?`, { 
            parse_mode: 'Markdown',
            ...opcoesBotoes 
        });

    } catch (error) {
        bot.sendMessage(chatId, "❌ Erro ao gerar o artigo. Verifique os logs.");
    }
});

// Listener para quando o usuário clicar nos botões (Aprovar / Rejeitar)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data; // ex: 'aprovar_123456789'

    const acao = data.split('_')[0];
    const artigoId = data.split('_')[1];

    const artigo = artigosPendentes[artigoId];

    if (!artigo) {
        return bot.sendMessage(chatId, "⚠️ Este artigo não está mais na memória (ou o bot foi reiniciado). Gere novamente.");
    }

    if (acao === 'rejeitar') {
        delete artigosPendentes[artigoId];
        // Remove os botões da mensagem e avisa
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        bot.sendMessage(chatId, "🗑️ Artigo *Rejeitado* e descartado.", { parse_mode: 'Markdown' });
    }

    if (acao === 'aprovar') {
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        bot.sendMessage(chatId, "🚀 Publicando artigo no GitHub...");

        try {
            // AQUI VOCÊ CONFIGURA SEUS SITES:
            // Para simplificar, vou usar variáveis de ambiente para o repositório principal
            // Mas você pode colocar lógica aqui para perguntar "Em qual site quer publicar?"
            
            const donoRepo = process.env.GITHUB_REPO_OWNER;
            const nomeRepo = process.env.GITHUB_REPO_NAME;
            const pastaPosts = process.env.GITHUB_POSTS_FOLDER || "src/content/blog"; // Padrão comum em Astro/Nextjs
            
            if (!donoRepo || !nomeRepo) {
                bot.sendMessage(chatId, "⚠️ Erro: Variáveis do GitHub não estão configuradas corretamente.");
                return;
            }

            const resultado = await publicarNoGitHub(artigo.conteudo, donoRepo, nomeRepo, pastaPosts);
            
            delete artigosPendentes[artigoId]; // Limpa da memória

            bot.sendMessage(chatId, `✅ *Artigo Publicado com Sucesso!*\n\nO GitHub recebeu o arquivo e a Vercel já deve iniciar o Deploy em breve.\n\n🔗 [Ver arquivo no GitHub](${resultado.url})`, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

        } catch (error) {
            bot.sendMessage(chatId, `❌ Erro ao publicar: ${error.message}`);
        }
    }
});

// Mensagem de boas vindas e instruções
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const instrucoes = `
👋 Olá! Eu sou o *Publicador Bot*.

Eu te ajudo a gerar e publicar artigos nos seus sites da Vercel.

*Como usar:*
Para criar um artigo, digite:
\`/gerar Seu Tema Aqui\`

Exemplo:
\`/gerar Os benefícios da inteligência artificial no marketing de conteúdo\`
    `;
    bot.sendMessage(chatId, instrucoes, { parse_mode: 'Markdown' });
});
