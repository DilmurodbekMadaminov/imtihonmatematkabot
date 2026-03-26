import { Telegraf } from "telegraf";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.log("No token");
  process.exit(1);
}

const bot = new Telegraf(botToken);
bot.telegram.setWebhook(`https://ais-pre-zwxesqr7uajqrp3m5f64nl-286796810075.asia-east1.run.app/telegraf/${bot.secretPathComponent()}`).then(() => {
  return bot.telegram.getWebhookInfo();
}).then(info => {
  console.log("WEBHOOK INFO:", JSON.stringify(info, null, 2));
}).catch(e => {
  console.error("ERROR:", e);
});
