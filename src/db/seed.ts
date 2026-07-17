// Seed Todd's starter catalog (design doc v0.3). Run: npm run db:seed
import { db } from "./index";
import { seedAll } from "./seed-data";

seedAll(db)
  .then(() => {
    console.log("Seeded.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
