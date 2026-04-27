import { prisma, isEncryptedSettingValue, isSecretSettingKey, protectSettingValue } from "../src";

async function main() {
  const rows = await prisma.setting.findMany({
    select: { id: true, key: true, value: true },
    orderBy: { key: "asc" },
  });

  let scanned = 0;
  let secrets = 0;
  let migrated = 0;
  let skippedEncrypted = 0;
  let skippedEmpty = 0;

  for (const row of rows) {
    scanned += 1;
    if (!isSecretSettingKey(row.key)) continue;
    secrets += 1;

    const raw = row.value;
    if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
      skippedEmpty += 1;
      continue;
    }
    if (isEncryptedSettingValue(raw)) {
      skippedEncrypted += 1;
      continue;
    }

    const encrypted = protectSettingValue(row.key, raw);
    if (encrypted === raw) continue;

    await prisma.setting.update({
      where: { id: row.id },
      data: { value: encrypted as any },
    });
    migrated += 1;
  }

  console.log(
    `[encrypt-secret-settings] scanned=${scanned} secretKeys=${secrets} migrated=${migrated} alreadyEncrypted=${skippedEncrypted} empty=${skippedEmpty}`,
  );
}

main()
  .catch((error) => {
    console.error("[encrypt-secret-settings] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
