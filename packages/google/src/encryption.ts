import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

/**
 * Derive encryption key from base key using PBKDF2
 */
function deriveKey(baseKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(baseKey, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64 encoded string: salt:iv:ciphertext:tag
 */
export function encrypt(text: string, baseKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(baseKey, salt)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, ciphertext, tag]).toString('base64')
}

/**
 * Decrypt a string encrypted with encrypt()
 */
export function decrypt(encrypted: string, baseKey: string): string {
  const data = Buffer.from(encrypted, 'base64')

  const salt = data.subarray(0, SALT_LENGTH)
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const tag = data.subarray(data.length - TAG_LENGTH)
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH, data.length - TAG_LENGTH)

  const key = deriveKey(baseKey, salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

/**
 * Encrypt an object as JSON
 */
export function encryptObject<T extends object>(obj: T, baseKey: string): string {
  return encrypt(JSON.stringify(obj), baseKey)
}

/**
 * Decrypt to object
 */
export function decryptObject<T extends object>(encrypted: string, baseKey: string): T {
  return JSON.parse(decrypt(encrypted, baseKey)) as T
}