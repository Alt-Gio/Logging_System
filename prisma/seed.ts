import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.admin.count()
  if (count === 0) {
    const hashed = await bcrypt.hash('dict2026!', 12)
    await prisma.admin.create({
      data: {
        username: 'admin',
        password: hashed,
        name:     'System Administrator',
        role:     'SUPER_ADMIN',
      },
    })
    console.log('✅ Admin created: admin / dict2026!')
    console.log('⚠️  CHANGE THIS PASSWORD after first login!')
  } else {
    console.log('ℹ️  Admin already exists, skipping.')
  }

  const defaults = [
    { key: 'wifiSsid',     value: 'DICT-DTC-Free' },
    { key: 'wifiPassword', value: '' },
    { key: 'wifiNote',     value: 'Free public WiFi for all DTC clients. No password required.' },
    { key: 'accessCode',   value: '2026' },
    { key: 'officeOpen',   value: '08:00' },
    { key: 'officeClose',  value: '17:00' },
  ]
  for (const s of defaults) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s })
  }
  console.log('✅ Default settings seeded')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
