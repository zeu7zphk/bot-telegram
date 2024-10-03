(async () => {
    const { Telegraf } = require('telegraf');
    const fs = require('fs');
    const schedule = require('node-schedule');
    const moment = require('moment-timezone');

    const botToken = '6096796903:AAEVLcK0ocOAL0-us0WCv2YfS2GMvB2kiCg';
    const chatId = '-1002265693726';
    const bot = new Telegraf(botToken);

    const scheduledJobs = {};

    async function loadScheduledMessages() {
        try {
            const data = fs.readFileSync('scheduledMessages.json', 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            return {};
        }
    }

    async function saveScheduledMessages(messages) {
        try {
            fs.writeFileSync('scheduledMessages.json', JSON.stringify(messages, null, 2), 'utf-8');
        } catch (err) {
            console.log('Erro ao salvar mensagens programadas: ', err);
        }
    }

    async function scheduleMessage(userId, messageContent, dateStr) {
        try {
            const scheduleDate = moment.tz(dateStr, 'DD/MM/YYYY HH:mm:ss', 'America/Sao_Paulo');

            const now = moment().tz('America/Sao_Paulo').startOf('minute');
            const scheduledMoment = scheduleDate.clone().startOf('minute');

            if (!scheduledMoment.isValid()) {
                await bot.telegram.sendMessage(userId, 'Data e hora inválidas.');
                return;
            }

            if (scheduledMoment.isBefore(now)) {
                await bot.telegram.sendMessage(userId, 'Não é possível agendar uma mensagem no passado.');
                return;
            }

            const messageId = Date.now().toString();
            const scheduledMessages = await loadScheduledMessages();
            scheduledMessages[messageId] = { messageText: messageContent, scheduleDate: scheduledMoment.format() };

            await saveScheduledMessages(scheduledMessages);

            const job = schedule.scheduleJob(scheduledMoment.toDate(), async () => {
                await bot.telegram.sendMessage(chatId, messageContent);
                console.log(`Mensagem programada enviada no chat ${chatId}`);

                delete scheduledMessages[messageId];
                await saveScheduledMessages(scheduledMessages);
                delete scheduledJobs[messageId];
            });

            scheduledJobs[messageId] = job;

            await bot.telegram.sendMessage(userId, `Mensagem programada para ${scheduledMoment.format('DD/MM/YYYY HH:mm:ss')}`);
        } catch (err) {
            console.log('Erro ao programar a mensagem: ', err);
            await bot.telegram.sendMessage(userId, 'Erro ao programar a mensagem. Verifique o formato e tente novamente.');
        }
    }

    bot.start((ctx) => {
        ctx.reply('Bem-vindo! Use /menu para ver os comandos disponíveis.');
    });

    bot.command('menu', (ctx) => {
        const menuContent = `
┏ 📋 *Menu de Comandos*
┃ 
┃ 1. **Programar Mensagem** /prog
┃    - Programar mensagem.
┃ 
┃ 2. **Ver Mensagens** /view
┃    - Mostra mensagens programadas.
┃ 
┃ 3. **Excluir Mensagens** /delete [número]
┃    - Exclui mensagens específicas.
┃ 
┃   Digite o comando desejado.
┃ 
┃ _Criado por: Andre_
┗━━━━━━━━━━
        `;
        ctx.reply(menuContent);
    });

    bot.command('prog', (ctx) => {
        const messageText = ctx.message.text.slice(5).trim();
        const userId = ctx.chat.id;

        if (!messageText) {
            ctx.reply('Formato inválido. Use o formato "Mensagem | dd/MM/yyyy HH:mm:ss".');
            return;
        }

        const [messageContent, dateStr] = messageText.split('|').map(part => part.trim());

        if (!messageContent || !dateStr) {
            ctx.reply('Formato inválido. Use o formato "Mensagem | dd/MM/yyyy HH:mm:ss".');
            return;
        }

        scheduleMessage(userId, messageContent, dateStr);
    });

    bot.command('view', async (ctx) => {
        try {
            const scheduledMessages = await loadScheduledMessages();
            if (Object.keys(scheduledMessages).length === 0) {
                await ctx.reply('Não há mensagens programadas.');
                return;
            }

            let messageList = 'Mensagens Programadas:\n\n';
            for (const [messageId, { messageText, scheduleDate }] of Object.entries(scheduledMessages)) {
                const formattedDate = moment(scheduleDate).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss');
                messageList += `${messageId} - ${messageText} (Data: ${formattedDate})\n`;
            }

            await ctx.reply(messageList);
        } catch (err) {
            console.log('Erro ao visualizar mensagens programadas: ', err);
            await ctx.reply('Erro ao visualizar mensagens programadas.');
        }
    });

    bot.command('delete', async (ctx) => {
        const messageNumber = ctx.message.text.split(' ')[1].trim();
        const userId = ctx.chat.id;

        try {
            const scheduledMessages = await loadScheduledMessages();
            const messageId = Object.keys(scheduledMessages)[messageNumber - 1];

            if (!messageId) {
                await ctx.reply('Número de mensagem inválido.');
                return;
            }

            if (scheduledJobs[messageId]) {
                scheduledJobs[messageId].cancel();
                delete scheduledJobs[messageId];
            }

            delete scheduledMessages[messageId];
            await saveScheduledMessages(scheduledMessages);

            await ctx.reply('Mensagem programada excluída com sucesso.');
        } catch (err) {
            console.log('Erro ao excluir mensagem programada: ', err);
            await ctx.reply('Erro ao excluir mensagem programada.');
        }
    });

    bot.launch();
})();
