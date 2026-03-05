<<<<<<< HEAD
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
=======
import { PrismaClient, PCStatus, Role } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function main() {
  console.log('🌱 Seeding...')

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: hashPassword('dict2026!'), name: 'System Administrator', role: Role.SUPER_ADMIN },
  })

  const pcs = [
    { name: 'PC-01', ipAddress: '192.168.1.101', location: 'Station A' },
    { name: 'PC-02', ipAddress: '192.168.1.102', location: 'Station A' },
    { name: 'PC-03', ipAddress: '192.168.1.103', location: 'Station B' },
    { name: 'PC-04', ipAddress: '192.168.1.104', location: 'Station B' },
    { name: 'PC-05', ipAddress: '192.168.1.105', location: 'Station C' },
    { name: 'PC-06', ipAddress: '192.168.1.106', location: 'Station C' },
    { name: 'PC-07', ipAddress: '192.168.1.107', location: 'Station D' },
    { name: 'PC-08', ipAddress: '192.168.1.108', location: 'Station D' },
  ]
  for (const pc of pcs) {
    await prisma.pC.upsert({ where: { ipAddress: pc.ipAddress }, update: {}, create: { ...pc, status: PCStatus.OFFLINE } })
  }

  // Default settings
  const defaults: Record<string, string> = {
    wifiSsid: 'DICT-DTC-Free',
    wifiPassword: '',
    wifiNote: 'Free public WiFi for all DTC clients. No password required.',
    accessCode: '1234',
    officeOpen: '08:00',
    officeClose: '17:00',
  }
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } })
  }

  console.log('✅ Seed complete!')
  console.log('🔑 Admin: admin / dict2026!')
  console.log('🔐 Access code: 1234')
}

main().catch(console.error).finally(() => prisma.$disconnect())
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
