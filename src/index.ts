import * as dotenv from 'dotenv';
import { runDailyBriefing } from './agent.js';
import { runTui } from './tui.js';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--tui')) {
    await runTui();
  } else {
    console.log('Running Daily Briefing...');
    await runDailyBriefing();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
