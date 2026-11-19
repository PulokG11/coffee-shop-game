// Zips dist-api/index.mjs (from `npm run api:build`) into dist-api/api.zip for a Neon Function
// deploy, and writes its base64 form next to it. No dependencies: one deflated entry.
import { readFileSync, writeFileSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'

const name = Buffer.from('index.mjs')
const data = readFileSync('dist-api/index.mjs')
const packed = deflateRawSync(data, { level: 9 })
const crc = crc32(data)

const local = Buffer.alloc(30)
local.writeUInt32LE(0x04034b50, 0)
local.writeUInt16LE(20, 4)
local.writeUInt16LE(0, 6)
local.writeUInt16LE(8, 8)
local.writeUInt32LE(0, 10)
local.writeUInt32LE(crc, 14)
local.writeUInt32LE(packed.length, 18)
local.writeUInt32LE(data.length, 22)
local.writeUInt16LE(name.length, 26)
local.writeUInt16LE(0, 28)

const central = Buffer.alloc(46)
central.writeUInt32LE(0x02014b50, 0)
central.writeUInt16LE(20, 4)
central.writeUInt16LE(20, 6)
central.writeUInt16LE(0, 8)
central.writeUInt16LE(8, 10)
central.writeUInt32LE(0, 12)
central.writeUInt32LE(crc, 16)
central.writeUInt32LE(packed.length, 20)
central.writeUInt32LE(data.length, 24)
central.writeUInt16LE(name.length, 28)
central.writeUInt32LE((0o100644 << 16) >>> 0, 38)
central.writeUInt32LE(0, 42)

const centralOffset = local.length + name.length + packed.length
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(1, 8)
end.writeUInt16LE(1, 10)
end.writeUInt32LE(central.length + name.length, 12)
end.writeUInt32LE(centralOffset, 16)

const zip = Buffer.concat([local, name, packed, central, name, end])
writeFileSync('dist-api/api.zip', zip)
writeFileSync('dist-api/api.zip.b64', zip.toString('base64'))
console.log(`dist-api/api.zip: ${data.length} bytes -> ${zip.length} bytes zipped`)
