const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// === КОНФИГУРАЦИЯ ===
const config = {
    token: process.env.TOKEN
    applicationsChannelId: '1467871123445121190',
    // ID ролей для заявок (ЗАМЕНИТЕ НА СВОИ!)
    applicationRoles: {
        classic: '1460577169708290212',      // ID роли @✨ | Classic |
        norules: '1467824740159852627',      // ID роли @🧪 | NoRules |
        mediumrp: '1465646386359042221',    // ID роли @📍 | MediumRP |
        discord: '1460577257251667979'       // ID роли @🛡️ | Discord |
    },
    // Каналы для разных типов жалоб
    complaintChannels: {
        players: '1460208499375214613',      // Канал для жалоб на игроков
        donors: '1469027794129260605',       // Канал для жалоб на донатеров
        admins: '1460208294705758281',       // Канал для жалоб на админов
        leadership: '1469029273137320159',   // Канал для жалоб на руководство
        discord: '1469029400346497237',       // Канал для жалоб на дискорд
        unban: '1470069676594696223'          // Канал для заявок на разбан
    }
};

const applications = new Map();
const complaints = new Map();
const complaintMessages = new Map();

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getComplaintTypeName(type) {
    const names = {
        'players': 'на игрока',
        'donors': 'на донатера',
        'admins': 'на администратора',
        'leadership': 'на руководство',
        'discord': 'на нарушение в Discord',
        'unban': 'на разбан'
    };
    return names[type] || type;
}

function getComplaintChannelId(type) {
    const channels = {
        'players': config.complaintChannels.players,
        'donors': config.complaintChannels.donors,
        'admins': config.complaintChannels.admins,
        'leadership': config.complaintChannels.leadership,
        'discord': config.complaintChannels.discord,
        'unban': config.complaintChannels.unban
    };
    return channels[type];
}

function getRoleIdForServer(serverType) {
    const roles = {
        'classic': config.applicationRoles.classic,
        'norules': config.applicationRoles.norules,
        'mediumrp': config.applicationRoles.mediumrp,
        'discord': config.applicationRoles.discord
    };
    return roles[serverType];
}

function getCommandName(type) {
    const commands = {
        'players': '!жалоба-игроки',
        'donors': '!жалоба-донатеры',
        'admins': '!жалоба-админы',
        'leadership': '!жалоба-руководство',
        'discord': '!жалоба-дискорд',
        'unban': '!заявка-разбан'
    };
    return commands[type];
}

function getEmbedTitle(type) {
    const titles = {
        'players': 'Жалоба на игрока',
        'donors': 'Жалоба на донатера',
        'admins': 'Жалоба на администратора',
        'leadership': 'Жалоба на руководство',
        'discord': 'Жалоба на нарушение в Discord',
        'unban': 'Заявка на разбан'
    };
    return titles[type] || type;
}

function getServerFullName(serverType) {
    const names = {
        'classic': 'Classic',
        'norules': 'NoRules',
        'mediumrp': 'MediumRP',
        'discord': 'Discord отдел'
    };
    return names[serverType] || serverType;
}

// ==================== КРАСИВЫЙ EMBED ДЛЯ ЖАЛОБ (КАК НА СКРИНШОТЕ) ====================
function createComplaintEmbed(complaintData, complaintId, user, moderator = null, status = 'pending', reason = null) {
    // Цвета для статусов
    const statusColors = {
        'pending': 0x808080,
        'review': 0xFEE75C,
        'accepted': 0x57F287,
        'rejected': 0xED4245
    };
    
    // Текст статуса
    const statusText = {
        'pending': 'Ожидание',
        'review': 'На рассмотрении',
        'accepted': 'Принято',
        'rejected': 'Отклонено'
    };
    
    // ПОЛУЧАЕМ ПРАВИЛЬНЫЙ ОБЪЕКТ ПОЛЬЗОВАТЕЛЯ
    let userObject;
    if (user.user) {
        // Это interaction
        userObject = user.user;
    } else {
        // Это user объект
        userObject = user;
    }
    
    const userAvatar = userObject.displayAvatarURL({ dynamic: true });
    
    let description = '';
    
    if (complaintData.type === 'unban') {
        description += `**Место, где произошло нарушение**\n${complaintData.location}\n\n`;
        description += `**Нарушитель**\n${complaintData.violator}\n\n`;
        description += `**Что было нарушено**\n${complaintData.violation}\n\n`;
        description += `**Доказательства**\n${complaintData.evidence}\n\n`;
        description += `**Причина разбана**\n${complaintData.reasonUnban}\n\n`;
    } else {
        description += `**Место, где произошло нарушение**\n${complaintData.location}\n\n`;
        description += `**Нарушитель**\n${complaintData.violator}\n\n`;
        description += `**Что было нарушено**\n${complaintData.violation}\n\n`;
        description += `**Доказательства**\n${complaintData.evidence}\n\n`;
    }
    
    description += `**Статус**\n${statusText[status]}\n\n`;
    description += `**Жалобу рассмотрел(-а)**\n${moderator ? moderator : '-'}`;
    
    if (reason && status === 'rejected') {
        description += `\n\n**Причина отказа**\n${reason}`;
    }
    
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(statusColors[status] || 0x808080)
        .setTimestamp()
        .setAuthor({
            name: `Жалоба от ${userObject.username}`,
            iconURL: userAvatar
        });
    
    return embed;
}

// ==================== КРАСИВЫЙ EMBED ДЛЯ ЗАЯВОК (КАК НА СКРИНШОТЕ) ====================
function createApplicationEmbed(applicationData, applicationId, user, serverType, moderator = null, status = 'pending', reason = null) {
    // Эмодзи для разных серверов
    const serverEmojis = {
        'classic': '✨',
        'norules': '🌴',
        'mediumrp': '📍',
        'discord': '🖥️'
    };

     // Цвета для статусов
    const statusColors = {
        'pending': 0x808080,
        'review': 0xFEE75C,
        'accepted': 0x57F287,
        'rejected': 0xED4245
    };
       
 	// Текст статуса
    const statusText = {
        'pending': 'Ожидание',
        'review': 'На рассмотрении',
        'accepted': 'Принято',
        'rejected': 'Отклонено'
    };
    
    // Получаем правильный объект пользователя
    let userObject;
    if (user.user) {
        userObject = user.user;
    } else {
        userObject = user;
    }
    
    const userAvatar = userObject.displayAvatarURL({ dynamic: true });
    
    // Формируем описание
    let description = '';
    
    if (serverType === 'discord') {
        // Для Discord отдела - правильный порядок полей
        description += `**Ознакомлены с требованиями?**\n${applicationData.answers.requirements}\n\n`;
        description += `**Дата рождения**\n${applicationData.answers.birthdate}\n\n`;
        description += `**Умеете пользоваться JuniperBot?**\n${applicationData.answers.bots}\n\n`;
        description += `**Опыт в модерации каналов?**\n${applicationData.answers.experience}\n\n`;
        description += `**Почему именно вас должны принять?**\n${applicationData.answers.why_you}\n\n`;
    } else {
        // Для игровых серверов
        description += `**Ознакомлены с требованиями?**\n${applicationData.answers.requirements}\n\n`;
        description += `**Дата рождения**\n${applicationData.answers.birthdate}\n\n`;
        description += `**Ссылка на Steam профиль**\n${applicationData.answers.steam}\n\n`;
        description += `**Опыт в администрации?**\n${applicationData.answers.experience}\n\n`;
        description += `**Почему именно вас должны принять?**\n${applicationData.answers.why_you}\n\n`;
    }
    
    description += `**Статус**\n${statusText[status]}\n\n`;
    description += `**Заявку рассмотрел(-а)**\n${moderator ? moderator : '-'}`;
    
    if (reason && status === 'rejected') {
        description += `\n\n**Причина отказа**\n${reason}`;
    }
    
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(statusColors[status] || 0x808080)
        .setTimestamp()
        .setAuthor({
            name: `Заявка на ${getServerFullName(serverType)} от ${userObject.username}`,
            iconURL: userAvatar
        });
    
    return embed;
}

// ==================== КНОПКИ ДЛЯ ЖАЛОБ ====================
function createComplaintButtons(complaintId, type, status = 'pending') {
    const edit = new ButtonBuilder()
        .setCustomId(`edit_complaint_${complaintId}`)
        .setLabel('Редактировать')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️');

    const deleteBtn = new ButtonBuilder()
        .setCustomId(`delete_complaint_${complaintId}`)
        .setLabel('Удалить')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

    const accept = new ButtonBuilder()
        .setCustomId(`accept_complaint_${complaintId}`)
        .setLabel('Принять')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✔️');

    const review = new ButtonBuilder()
        .setCustomId(`review_complaint_${complaintId}`)
        .setLabel('На рассмотрение')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💡');

    const reject = new ButtonBuilder()
        .setCustomId(`reject_complaint_${complaintId}`)
        .setLabel('Отклонить')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('✖');

    // Если жалоба уже обработана, делаем кнопки неактивными
    if (status !== 'pending' && status !== 'review') {
        edit.setDisabled(true);
        deleteBtn.setDisabled(true);
        accept.setDisabled(true);
        review.setDisabled(true);
        reject.setDisabled(true);
    }

    const row1 = new ActionRowBuilder().addComponents(edit, deleteBtn);
    const row2 = new ActionRowBuilder().addComponents(accept, review, reject);
    
    return [row1, row2];
}

// ==================== КНОПКИ ДЛЯ ЗАЯВОК ====================
function createApplicationButtons(applicationId, status = 'pending') {
    const accept = new ButtonBuilder()
        .setCustomId(`accept_app_${applicationId}`)
        .setLabel('Принять')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✔️');

    const review = new ButtonBuilder()
        .setCustomId(`review_app_${applicationId}`)
        .setLabel('На рассмотрение')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💡');

    const reject = new ButtonBuilder()
        .setCustomId(`reject_app_${applicationId}`)
        .setLabel('Отклонить')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('✖');

    // Если заявка уже обработана, делаем кнопки неактивными
    if (status !== 'pending' && status !== 'review') {
        accept.setDisabled(true);
        review.setDisabled(true);
        reject.setDisabled(true);
    }

    return [new ActionRowBuilder().addComponents(accept, review, reject)];
}

// ==================== КНОПКИ ВЫБОРА СЕРВЕРА ====================
function createServerSelectionButtons() {
    const classic = new ButtonBuilder()
        .setCustomId('apply_classic')
        .setLabel('Подать в Classic')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨');

    const noRules = new ButtonBuilder()
        .setCustomId('apply_norules')
        .setLabel('Подать в NoRules')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🌴');

    const mediumRP = new ButtonBuilder()
        .setCustomId('apply_mediumrp')
        .setLabel('Подать в MediumRP')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📍');

    const discord = new ButtonBuilder()
        .setCustomId('apply_discord')
        .setLabel('Подать в Discord')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🖥️');

    const row1 = new ActionRowBuilder().addComponents(classic, noRules, mediumRP, discord);
    return [row1];
}

// ==================== КНОПКИ ДЛЯ ЖАЛОБ ====================
function createComplaintButtonsOld(type) {
    const button = new ButtonBuilder()
        .setCustomId(`complaint_btn_${type}`)
        .setLabel('Подать жалобу')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✍️');

    return [new ActionRowBuilder().addComponents(button)];
}

// ==================== ФОРМА ДЛЯ ЖАЛОБ (ЕДИНАЯ ДЛЯ ВСЕХ ТИПОВ) ====================
function createComplaintModal(complaintType) {
    const modal = new ModalBuilder()
        .setCustomId(`complaint_${complaintType}_${Date.now()}`)
        .setTitle(`Подача жалобы ${getComplaintTypeName(complaintType)}`);

    const q1 = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('Место, где произошло нарушение')
        .setPlaceholder('Название сервера (например, Classic, NoRules, MediumRP или Discord)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('violator')
        .setLabel('Нарушитель')
        .setPlaceholder('Никнейм (По возможности SteamID64)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('violation')
        .setLabel('Что было нарушено')
        .setPlaceholder('Номер правила или краткое содержание ситуации')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('evidence')
        .setLabel('Доказательства')
        .setPlaceholder('Наличие доказательств обязательно (ссылки, скриншоты и т.д.)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);

    modal.addComponents(row1, row2, row3, row4);
    
    // Для заявки на разбан добавляем дополнительный вопрос
    if (complaintType === 'unban') {
        const q5 = new TextInputBuilder()
            .setCustomId('reason_unban')
            .setLabel('Причина разбана')
            .setPlaceholder('Почему вас стоит разбанить?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        const row5 = new ActionRowBuilder().addComponents(q5);
        modal.addComponents(row5);
    }

    return modal;
}

// ==================== ФОРМА ДЛЯ КЛАССИК ====================
function createClassicModal() {
    const modal = new ModalBuilder()
        .setCustomId(`application_classic_${Date.now()}`)
        .setTitle('Подача заявки в Classic');

    const q1 = new TextInputBuilder()
        .setCustomId('requirements')
        .setLabel('Ознакомлены с требованиями?')
        .setPlaceholder('Да/Нет')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('birthdate')
        .setLabel('Дата рождения')
        .setPlaceholder('Пример: 11.11.2002')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('steam')
        .setLabel('Ссылка на ваш Steam профиль')
        .setPlaceholder('https://steamcommunity.com/profiles/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Опыт в администрации?')
        .setPlaceholder("Опишите опыт или 'не было'")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const q5 = new TextInputBuilder()
        .setCustomId('why_you')
        .setLabel('Почему вы подходите для роли администратора?')
        .setPlaceholder('Опишите вашу стрессоустойчивость, умение действовать в разных ситуациях и другие свои качества')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);
    const row5 = new ActionRowBuilder().addComponents(q5);

    modal.addComponents(row1, row2, row3, row4, row5);
    return modal;
}

// ==================== ФОРМА ДЛЯ NORULES ====================
function createNoRulesModal() {
    const modal = new ModalBuilder()
        .setCustomId(`application_norules_${Date.now()}`)
        .setTitle('Подача заявки в NoRules');

    const q1 = new TextInputBuilder()
        .setCustomId('requirements')
        .setLabel('Ознакомлены с требованиями?')
        .setPlaceholder('Да/Нет')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('birthdate')
        .setLabel('Дата рождения')
        .setPlaceholder('Пример: 11.11.2002')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('steam')
        .setLabel('Ссылка на ваш Steam профиль')
        .setPlaceholder('https://steamcommunity.com/profiles/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Опыт в администрации?')
        .setPlaceholder("Опишите опыт или 'не было'")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const q5 = new TextInputBuilder()
        .setCustomId('why_you')
        .setLabel('Почему вы подходите для роли администратора?')
        .setPlaceholder('Опишите вашу стрессоустойчивость, умение действовать в разных ситуациях и другие свои качества')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);
    const row5 = new ActionRowBuilder().addComponents(q5);

    modal.addComponents(row1, row2, row3, row4, row5);
    return modal;
}

// ==================== ФОРМА ДЛЯ MEDIUMRP ====================
function createMediumRPModal() {
    const modal = new ModalBuilder()
        .setCustomId(`application_mediumrp_${Date.now()}`)
        .setTitle('Подача заявки в MediumRP');

    const q1 = new TextInputBuilder()
        .setCustomId('requirements')
        .setLabel('Ознакомлены с требованиями?')
        .setPlaceholder('Да/Нет')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('birthdate')
        .setLabel('Дата рождения')
        .setPlaceholder('Пример: 11.11.2002')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('steam')
        .setLabel('Ссылка на ваш Steam профиль')
        .setPlaceholder('https://steamcommunity.com/profiles/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Опыт в администрировании на РП-серверах?')
        .setPlaceholder("Опишите опыт или 'не было'")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const q5 = new TextInputBuilder()
        .setCustomId('why_you')
        .setLabel('Почему вы подходите для роли администратора?')
        .setPlaceholder('Расскажите о вашем понимании ролевой игры, умении решать конфликты и поддерживать игровую атмосферу')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);
    const row5 = new ActionRowBuilder().addComponents(q5);

    modal.addComponents(row1, row2, row3, row4, row5);
    return modal;
}

// ==================== ФОРМА ДЛЯ DISCORD ОТДЕЛА ====================
function createDiscordModal() {
    const modal = new ModalBuilder()
        .setCustomId(`application_discord_${Date.now()}`)
        .setTitle('Заявка в Discord отдел');

    const q1 = new TextInputBuilder()
        .setCustomId('requirements')
        .setLabel('Ознакомлены с требованиями?')
        .setPlaceholder('Да/Нет')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('birthdate')
        .setLabel('Дата рождения')
        .setPlaceholder('Пример: 11.11.2002')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('bots')
        .setLabel('Умеете пользоваться JuniperBot?')
        .setPlaceholder("Напишите да или 'Готов обучаться'")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Опыт в модерации каналов?')
        .setPlaceholder("Опишите опыт или напишите 'не было'")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const q5 = new TextInputBuilder()
        .setCustomId('why_you')
        .setLabel('Почему именно вас должны принять?')
        .setPlaceholder('Опишите себя')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);
    const row5 = new ActionRowBuilder().addComponents(q5);

    modal.addComponents(row1, row2, row3, row4, row5);
    return modal;
}

// ==================== ФОРМА ДЛЯ РЕДАКТИРОВАНИЯ ЖАЛОБЫ ====================
function createEditComplaintModal(complaintId, complaintData) {
    const modal = new ModalBuilder()
        .setCustomId(`edit_complaint_modal_${complaintId}`)
        .setTitle(`Редактирование жалобы - ${getComplaintTypeName(complaintData.type)}`);

    const q1 = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('Место, где произошло нарушение')
        .setPlaceholder('Пример: Classic, NoRules, MediumRP, Discord')
        .setStyle(TextInputStyle.Short)
        .setValue(complaintData.location || '')
        .setRequired(true);

    const q2 = new TextInputBuilder()
        .setCustomId('violator')
        .setLabel('Нарушитель')
        .setPlaceholder('Никнейм / SteamID64')
        .setStyle(TextInputStyle.Short)
        .setValue(complaintData.violator || '')
        .setRequired(true);

    const q3 = new TextInputBuilder()
        .setCustomId('violation')
        .setLabel('Что было нарушено')
        .setPlaceholder('Номер правила или краткое содержание ситуации')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(complaintData.violation || '')
        .setRequired(true);

    const q4 = new TextInputBuilder()
        .setCustomId('evidence')
        .setLabel('Доказательства')
        .setPlaceholder('Наличие доказательств обязательно')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(complaintData.evidence || '')
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);

    modal.addComponents(row1, row2, row3, row4);
    
    if (complaintData.type === 'unban') {
        const q5 = new TextInputBuilder()
            .setCustomId('reason_unban')
            .setLabel('Причина разбана')
            .setPlaceholder('Почему вас стоит разбанить?')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(complaintData.reasonUnban || '')
            .setRequired(true);
        
        const row5 = new ActionRowBuilder().addComponents(q5);
        modal.addComponents(row5);
    }
    
    return modal;
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    client.user.setActivity('за заявками и жалобами', { type: 'WATCHING' });
});

client.on(Events.InteractionCreate, async interaction => {
    // Обработка кнопок
    if (interaction.isButton()) {
        const buttonId = interaction.customId;
        
        // Кнопки подачи жалоб
        if (buttonId.startsWith('complaint_btn_')) {
            const type = buttonId.replace('complaint_btn_', '');
            const modal = createComplaintModal(type);
            await interaction.showModal(modal);
            return;
        }
        
        // Кнопки подачи заявок
        if (buttonId.startsWith('apply_')) {
            const serverType = buttonId.replace('apply_', '');
            let modal;
            
            switch(serverType) {
                case 'classic':
                    modal = createClassicModal();
                    break;
                case 'norules':
                    modal = createNoRulesModal();
                    break;
                case 'mediumrp':
                    modal = createMediumRPModal();
                    break;
                case 'discord':
                    modal = createDiscordModal();
                    break;
                default:
                    return interaction.reply({ content: '❌ Неизвестный тип сервера!', flags: 64 });
            }
            
            await interaction.showModal(modal);
            return;
        }

// Кнопки модерации заявок
if (buttonId.startsWith('accept_app_') || buttonId.startsWith('review_app_') || buttonId.startsWith('reject_app_')) {
    const [action, , applicationId] = buttonId.split('_');
    const applicationData = applications.get(applicationId);

    if (!applicationData) {
        return interaction.reply({ content: '❌ Заявка не найдена!', flags: 64 });
    }

    if (action === 'reject') {
        const modal = new ModalBuilder()
            .setCustomId(`reject_app_modal_${applicationId}`)
            .setTitle('Укажите причину отказа');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel('Причина отказа')
            .setPlaceholder('Опишите причину...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
    }

    const newStatus = action === 'accept' ? 'accepted' : 'review';
    applicationData.status = newStatus;
    applications.set(applicationId, applicationData);

    const applicant = await client.users.fetch(applicationData.userId);
    
    // ВАЖНО: Определяем правильный serverType для embed
    let serverTypeForEmbed;
    const serverTypeFull = applicationData.serverType;
    
    if (serverTypeFull === 'Discord отдел' || serverTypeFull.includes('Discord')) {
        serverTypeForEmbed = 'discord';
    } else if (serverTypeFull === 'Classic') {
        serverTypeForEmbed = 'classic';
    } else if (serverTypeFull === 'NoRules') {
        serverTypeForEmbed = 'norules';
    } else if (serverTypeFull === 'MediumRP') {
        serverTypeForEmbed = 'mediumrp';
    } else {
        serverTypeForEmbed = serverTypeFull.toLowerCase();
    }
    
    const embed = createApplicationEmbed(
        applicationData, 
        applicationId, 
        applicant, 
        serverTypeForEmbed,  // Используем правильный тип
        interaction.user,
        newStatus
    );

    const buttons = createApplicationButtons(applicationId, newStatus);
    await interaction.update({ embeds: [embed], components: buttons });

    try {
        const user = await client.users.fetch(applicationData.userId);
        if (action === 'accept') {
            await user.send(`✅ Ваша заявка на **${applicationData.serverType}** принята!`);
        } else {
            await user.send(`💡 Ваша заявка на **${applicationData.serverType}** взята на рассмотрение.`);
        }
    } catch (err) {
        console.log('Не удалось уведомить пользователя');
    }

    await interaction.followUp({ content: `✅ Заявка ${action === 'accept' ? 'принята' : 'отправлена на рассмотрение'}`, flags: 64 });
    return;
}
        
        // Кнопки модерации жалоб
        if (buttonId.startsWith('edit_complaint_') || buttonId.startsWith('delete_complaint_') || 
            buttonId.startsWith('accept_complaint_') || buttonId.startsWith('review_complaint_') || 
            buttonId.startsWith('reject_complaint_')) {
            
            const parts = buttonId.split('_');
            const action = parts[0];
            const complaintId = parts[2];
            const complaintData = complaints.get(complaintId);

            if (!complaintData) {
                return interaction.reply({ content: '❌ Жалоба не найдена!', flags: 64 });
            }

            if (action === 'edit') {
                if (interaction.user.id !== complaintData.userId) {
                    return interaction.reply({ content: '❌ Только автор жалобы может её редактировать!', flags: 64 });
                }
                const modal = createEditComplaintModal(complaintId, complaintData);
                await interaction.showModal(modal);
                return;
            }

            if (action === 'delete') {
                if (interaction.user.id !== complaintData.userId) {
                    return interaction.reply({ content: '❌ Только автор жалобы может её удалить!', flags: 64 });
                }
                try {
                    await interaction.message.delete();
                    complaints.delete(complaintId);
                    complaintMessages.delete(complaintId);
                    await interaction.reply({ content: '✅ Жалоба удалена', flags: 64 });
                } catch (err) {
                    console.error(err);
                    await interaction.reply({ content: '❌ Ошибка при удалении жалобы', flags: 64 });
                }
                return;
            }

            if (action === 'reject') {
                const modal = new ModalBuilder()
                    .setCustomId(`reject_complaint_modal_${complaintId}`)
                    .setTitle('Укажите причину отказа жалобы');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reject_reason')
                    .setLabel('Причина отказа')
                    .setPlaceholder('Опишите причину отказа жалобы...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
                return;
            }

            const newStatus = action === 'accept' ? 'accepted' : 'review';
            complaintData.status = newStatus;
            complaints.set(complaintId, complaintData);

            const complainant = await client.users.fetch(complaintData.userId);
            const embed = createComplaintEmbed(
                complaintData, 
                complaintId, 
                complainant,
                interaction.user,
                newStatus
            );

            const buttons = createComplaintButtons(complaintId, complaintData.type, newStatus);
            await interaction.update({ embeds: [embed], components: buttons });

            try {
                const user = await client.users.fetch(complaintData.userId);
                if (action === 'accept') {
                    await user.send(`✅ Ваша жалоба принята модератором ${interaction.user.tag}.`);
                } else {
                    await user.send(`💡 Ваша жалоба взята на рассмотрение модератором ${interaction.user.tag}.`);
                }
            } catch (err) {
                console.log('Не удалось уведомить пользователя');
            }

            await interaction.followUp({ 
                content: `✅ Жалоба ${action === 'accept' ? 'принята' : 'отправлена на рассмотрение'}`, 
                flags: 64 
            });
            
            return;
        }
    }
    
    // Обработка модальных окон (submit)
    if (interaction.isModalSubmit()) {
        // Обработка отправки жалобы
        if (interaction.customId.startsWith('complaint_')) {
            const parts = interaction.customId.split('_');
            const complaintType = parts[1];
            const complaintId = Date.now().toString();
            
            const complaintData = {
                userId: interaction.user.id,
                type: complaintType,
                location: interaction.fields.getTextInputValue('location'),
                violator: interaction.fields.getTextInputValue('violator'),
                violation: interaction.fields.getTextInputValue('violation'),
                evidence: interaction.fields.getTextInputValue('evidence'),
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            if (complaintType === 'unban') {
                complaintData.reasonUnban = interaction.fields.getTextInputValue('reason_unban');
            }
            
            complaints.set(complaintId, complaintData);

            const embed = createComplaintEmbed(complaintData, complaintId, interaction.user, null, 'pending');

            try {
                const channelId = getComplaintChannelId(complaintType);
                const channel = await client.channels.fetch(channelId);
                
                if (channel) {
                    const buttons = createComplaintButtons(complaintId, complaintType, 'pending');
                    const sentMessage = await channel.send({ embeds: [embed], components: buttons });
                    
                    complaintMessages.set(complaintId, {
                        messageId: sentMessage.id,
                        channelId: channelId,
                        guildId: channel.guildId,
                        url: `https://discord.com/channels/${channel.guildId}/${channelId}/${sentMessage.id}`
                    });
                    
                    await interaction.reply({ 
                        content: `✅ Ваша жалоба отправлена!\n🔗 Ссылка на сообщение: ${complaintMessages.get(complaintId).url}`,
                        flags: 64
                    });
                } else {
                    throw new Error('Канал не найден');
                }
            } catch (error) {
                console.error('Ошибка отправки жалобы:', error);
                await interaction.reply({ 
                    content: '❌ Ошибка при отправке жалобы. Проверьте настройки бота.',
                    flags: 64
                });
            }
            
            return;
        }
        
	// Обработка отправки заявки
	if (interaction.customId.startsWith('application_')) {
    	const parts = interaction.customId.split('_');
    	const serverType = parts[1];
    	const applicationId = Date.now().toString();
    
    	let answers;
    
    	if (serverType === 'discord') {
        	answers = {
            	requirements: interaction.fields.getTextInputValue('requirements'),
            	birthdate: interaction.fields.getTextInputValue('birthdate'),
            	bots: interaction.fields.getTextInputValue('bots'),
           	 experience: interaction.fields.getTextInputValue('experience'),
            	why_you: interaction.fields.getTextInputValue('why_you')
	        };
	    } else {
        	answers = {
            	requirements: interaction.fields.getTextInputValue('requirements'),
            	birthdate: interaction.fields.getTextInputValue('birthdate'),
            	steam: interaction.fields.getTextInputValue('steam'),
            	experience: interaction.fields.getTextInputValue('experience'),
            	why_you: interaction.fields.getTextInputValue('why_you')
        };
    }
    
    const applicationData = {
        userId: interaction.user.id,
        serverType: getServerFullName(serverType),
        answers: answers,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    applications.set(applicationId, applicationData);

    const embed = createApplicationEmbed(applicationData, applicationId, interaction, serverType, null, 'pending');

    try {
        const channel = await client.channels.fetch(config.applicationsChannelId);
        if (channel) {
            const buttons = createApplicationButtons(applicationId, 'pending');
            
            // Получаем ID роли для пинга
            const roleId = getRoleIdForServer(serverType);
            
            // Создаем контент с пингом роли
            let content = '';
            if (roleId) {
                content = `<@&${roleId}>`;
            }
            
            // Отправляем сообщение с пингом роли и эмбедом
            await channel.send({ 
                content: content,
                embeds: [embed], 
                components: buttons 
            });
            
            await interaction.reply({ 
                content: `✅ Ваша заявка на **${getServerFullName(serverType)}** отправлена!`,
                flags: 64
            });
        } else {
            throw new Error('Канал не найден');
        }
    } catch (error) {
        console.error('Ошибка отправки заявки:', error);
        await interaction.reply({ 
            content: '❌ Ошибка при отправке заявки. Проверьте настройки бота.',
            flags: 64
        });
    }
    
    return;
}     
   
        // Обработка редактирования жалобы
        if (interaction.customId.startsWith('edit_complaint_modal_')) {
            const complaintId = interaction.customId.replace('edit_complaint_modal_', '');
            const complaintData = complaints.get(complaintId);
            
            if (!complaintData) {
                return interaction.reply({ content: '❌ Жалоба не найдена!', flags: 64 });
            }
            
            if (interaction.user.id !== complaintData.userId) {
                return interaction.reply({ content: '❌ Только автор жалобы может её редактировать!', flags: 64 });
            }
            
            complaintData.location = interaction.fields.getTextInputValue('location');
            complaintData.violator = interaction.fields.getTextInputValue('violator');
            complaintData.violation = interaction.fields.getTextInputValue('violation');
            complaintData.evidence = interaction.fields.getTextInputValue('evidence');
            
            if (complaintData.type === 'unban') {
                complaintData.reasonUnban = interaction.fields.getTextInputValue('reason_unban');
            }
            
            complaints.set(complaintId, complaintData);
            
            const complainant = await client.users.fetch(complaintData.userId);
            const embed = createComplaintEmbed(complaintData, complaintId, complainant, null, complaintData.status);
            
            const buttons = createComplaintButtons(complaintId, complaintData.type, complaintData.status);
            await interaction.update({ embeds: [embed], components: buttons });
            
            await interaction.followUp({ content: '✅ Жалоба успешно отредактирована!', flags: 64 });
            return;
        }
        
// Обработка отказа заявки
if (interaction.customId.startsWith('reject_app_modal_')) {
    const applicationId = interaction.customId.replace('reject_app_modal_', '');
    const reason = interaction.fields.getTextInputValue('reject_reason');
    const applicationData = applications.get(applicationId);            
    
    if (applicationData) {
        applicationData.status = 'rejected';
        applications.set(applicationId, applicationData);
        
        const applicant = await client.users.fetch(applicationData.userId);
        
        // ВАЖНО: Определяем правильный serverType для embed
        let serverTypeForEmbed;
        if (applicationData.serverType === 'Discord отдел' || applicationData.serverType.includes('Discord')) {
            serverTypeForEmbed = 'discord';
        } else if (applicationData.serverType === 'Classic') {
            serverTypeForEmbed = 'classic';
        } else if (applicationData.serverType === 'NoRules') {
            serverTypeForEmbed = 'norules';
        } else if (applicationData.serverType === 'MediumRP') {
            serverTypeForEmbed = 'mediumrp';
        } else {
            serverTypeForEmbed = applicationData.serverType.toLowerCase();
        }
        
        const embed = createApplicationEmbed(
            applicationData, 
            applicationId, 
            applicant, 
            serverTypeForEmbed,  // Используем правильный тип
            interaction.user,
            'rejected',
            reason
        );
        
        const buttons = createApplicationButtons(applicationId, 'rejected');
        await interaction.message.edit({ embeds: [embed], components: buttons });
        
        try {
            const user = await client.users.fetch(applicationData.userId);
            await user.send(`❌ Ваша заявка на **${applicationData.serverType}** отклонена.\nПричина: ${reason}`);
        } catch (err) {
            console.log('Не удалось уведомить заявителя');
        }
        
        await interaction.reply({ content: '✅ Заявка отклонена', flags: 64 });
    } else {
        await interaction.reply({ content: '❌ Заявка не найдена', flags: 64 });
    }
    return;
}        

        // Обработка отказа жалобы
        if (interaction.customId.startsWith('reject_complaint_modal_')) {
            const complaintId = interaction.customId.replace('reject_complaint_modal_', '');
            const reason = interaction.fields.getTextInputValue('reject_reason');
            const complaintData = complaints.get(complaintId);
            
            if (complaintData) {
                complaintData.status = 'rejected';
                complaints.set(complaintId, complaintData);
                
                const complainant = await client.users.fetch(complaintData.userId);
                const embed = createComplaintEmbed(
                    complaintData, 
                    complaintId, 
                    complainant,
                    interaction.user,
                    'rejected',
                    reason
                );
                
                const buttons = createComplaintButtons(complaintId, complaintData.type, 'rejected');
                await interaction.message.edit({ embeds: [embed], components: buttons });
                
                try {
                    const user = await client.users.fetch(complaintData.userId);
                    await user.send(`❌ Ваша жалоба отклонена модератором ${interaction.user.tag}.\nПричина: ${reason}`);
                } catch (err) {
                    console.log('Не удалось уведомить заявителя');
                }
                
                await interaction.reply({ content: '✅ Жалоба отклонена', flags: 64 });
            } else {
                await interaction.reply({ content: '❌ Жалоба не найдена', flags: 64 });
            }
            return;
        }
    }
});

// ==================== КОМАНДЫ ====================
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // Команда !панель для заявок
    if (message.content === '!панель') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ Нужны права администратора!');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📝 ЗАЯВКИ НА АДМИНИСТРАЦИЮ 📝')
            .setDescription(`Пожалуйста, внимательно ознакомьтесь с условиями. **Заявка будет отклонена**, если вы нарушаете один или несколько пунктов ниже:\n\n` +
                `> ✦ | **1.** Наигрыш в **SCP: Secret Laboratory** — менее **100 часов**.\n` +
                `> ✦ | **2.** **Закрытый профиль Steam**.\n` +
                `> ✦ | **3.** Заявка заполнена **неверно, небрежно или не до конца, в шуточной форме**, или же заполнена **с помощью других лиц, ИИ или скопирована из интернета**.\n` +
                `> ✦ | **4.** Возраст **младше 14 лет**.\n` +
                `> ✦ | **5.** Аккаунт Discord создан **менее месяца назад**.\n` +
                `> ✦ | **6.** Неадекватное поведение во время **обзвона/собеседования**.\n` +
                `> ✦ | **7.** Серьёзные нарушения на **любом сервере проекта** в прошлом.\n` +
                `> ✦ | **8.** Использование **VoiceMod** или иных искажателей голоса **при обзвоне**.\n` +
                `> ✦ | **9.** Нахождение в **ЧСП** (Чёрном списке проекта).\n` +
                `> ✦ | **10.** **Действующий бан** на одном из серверов проекта.\n` +
                `> ✦ | **11.** **Крайне плохое** знание **Консоли Администратора** и **нежелание обучаться**.\n` +
                `> ✦ | **12.** **Плохое знание** правил сервера и регламента администрации.\n\n` +
                `! | **Примечание:** \` В случае одобрения вашей заявки руководство свяжется с вами в личных сообщениях в течении 3-х дней. В противном случае, скорее всего, заявка отклонена. \`\n\n` +
                `### Подавайте заявки ответственно.`)
            .setColor(0x808080)
            .setFooter({ text: 'Выберите сервер для подачи заявки:' });

        const buttons = createServerSelectionButtons();
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    // Команды для жалоб (6 штук)
    else if (message.content === '!жалоба-игроки') {
        const embed = new EmbedBuilder()
            .setTitle('Подача жалобы на игрока')
            .setDescription('Нажмите на кнопку ниже, чтобы подать жалобу на игрока.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Жалобы без доказательств рассматриваться не будут' });

        const buttons = createComplaintButtonsOld('players');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    else if (message.content === '!жалоба-донатеры') {
        const embed = new EmbedBuilder()
            .setTitle('Подача жалобы на донатера')
            .setDescription('Нажмите на кнопку ниже, чтобы подать жалобу на донатера.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Жалобы без доказательств рассматриваться не будут' });

        const buttons = createComplaintButtonsOld('donors');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    else if (message.content === '!жалоба-админы') {
        const embed = new EmbedBuilder()
            .setTitle('Подача жалобы на администрацию')
            .setDescription('Нажмите на кнопку ниже, чтобы подать жалобу на администратора.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Жалобы без доказательств рассматриваться не будут' });

        const buttons = createComplaintButtonsOld('admins');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    else if (message.content === '!жалоба-руководство') {
        const embed = new EmbedBuilder()
            .setTitle('Подача жалобы на руководство')
            .setDescription('Нажмите на кнопку ниже, чтобы подать жалобу на руководство.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Жалобы без доказательств рассматриваться не будут' });

        const buttons = createComplaintButtonsOld('leadership');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    else if (message.content === '!жалоба-дискорд') {
        const embed = new EmbedBuilder()
            .setTitle('Подача жалобы на нарушение в Discord')
            .setDescription('Нажмите на кнопку ниже, чтобы подать жалобу на нарушение в Discord.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Жалобы без доказательств рассматриваться не будут' });

        const buttons = createComplaintButtonsOld('discord');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
    
    else if (message.content === '!заявка-разбан') {
        const embed = new EmbedBuilder()
            .setTitle('Подача заявки на разбан')
            .setDescription('Нажмите на кнопку ниже, чтобы подать заявку на разбан.\n\nЗаполните все поля формы внимательно.')
            .setColor(0x808080)
            .setFooter({ text: 'Укажите подробную причину разбана' });

        const buttons = createComplaintButtonsOld('unban');
        await message.channel.send({ embeds: [embed], components: buttons });
    }
});

// Запуск бота
client.login(config.token);

// === ОБРАБОТКА ОШИБОК ДЛЯ 24/7 РАБОТЫ ===
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Запуск бота с автоматическим переподключением
client.login(config.token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});