require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');

const { isVerified, addVerified } = require('./verified');
const { checkPurchase } = require('./shopify');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ─── Startup ────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

async function registerCommands() {
  const command = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post the verification embed to the verify channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON();

  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.DISCORD_GUILD_ID),
    { body: [command] }
  );
  console.log('Slash commands registered');
}

// ─── Interaction router ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
      await handleSetup(interaction);
    } else if (interaction.isButton() && interaction.customId === 'verify_button') {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId === 'verify_modal') {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
  }
});

// ─── /setup ──────────────────────────────────────────────────────────────────

async function handleSetup(interaction) {
  const channel = await client.channels.fetch(process.env.DISCORD_VERIFY_CHANNEL_ID).catch(() => null);
  if (!channel) {
    return interaction.reply({ content: 'Could not find the verify channel. Check `DISCORD_VERIFY_CHANNEL_ID` in .env.', flags: 64 });
  }

  const embed = new EmbedBuilder()
    .setTitle('Verify Your Purchase')
    .setDescription(
      'Click the button below and enter the email address you used at checkout.\n' +
      "Once verified, you'll receive the **Member** role and unlock access."
    )
    .setColor(0x5865f2);

  const button = new ButtonBuilder()
    .setCustomId('verify_button')
    .setLabel('Verify Purchase')
    .setStyle(ButtonStyle.Primary);

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
  await interaction.reply({ content: 'Verification embed posted.', flags: 64 });
}

// ─── Button → show modal ─────────────────────────────────────────────────────

async function handleButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('Verify Your Purchase');

  const emailInput = new TextInputBuilder()
    .setCustomId('email_input')
    .setLabel('Email used for purchase')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('you@example.com')
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(254);

  modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
  await interaction.showModal(modal);
}

// ─── Modal submit → verify flow ──────────────────────────────────────────────

async function handleModal(interaction) {
  await interaction.deferReply({ flags: 64 });

  const email = interaction.fields.getTextInputValue('email_input').trim().toLowerCase();
  const member = interaction.member;

  // Already in verified.json
  if (isVerified(email)) {
    return interaction.editReply({ content: "You're already verified! You should already have the Member role." });
  }

  // Already has the role
  if (member.roles.cache.has(process.env.DISCORD_ROLE_ID)) {
    return interaction.editReply({ content: "You already have the Member role — you're all set!" });
  }

  // Check Shopify
  let purchased;
  try {
    purchased = await checkPurchase(email);
  } catch (err) {
    console.error('Shopify error:', err);
    return interaction.editReply({ content: 'Verification is temporarily unavailable, please try again later.' });
  }

  if (!purchased) {
    return interaction.editReply({
      content:
        "We couldn't find a completed purchase for that email.\n" +
        'Make sure you\'re using the exact email you checked out with, then try again.',
    });
  }

  // Assign role
  try {
    await member.roles.add(process.env.DISCORD_ROLE_ID);
  } catch (err) {
    console.error('Role assignment error:', err);
    return interaction.editReply({ content: 'Verification is temporarily unavailable, please try again later.' });
  }

  addVerified(email);
  return interaction.editReply({ content: "You're verified! Welcome — you now have access to the member area." });
}

// ─── Login ───────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_BOT_TOKEN);
