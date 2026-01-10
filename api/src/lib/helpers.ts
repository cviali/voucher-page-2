import { vouchers } from '../db/schema'
import { eq, or } from 'drizzle-orm'

export const normalizePhone = (phone: string | null | undefined) => {
    if (!phone) return phone
    return phone.startsWith('0') ? phone.substring(1) : phone
}

export const generateVoucherCode = async (db: any) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const existingCodes = await db.select({ code: vouchers.code })
        .from(vouchers)
        .where(or(eq(vouchers.status, 'available'), eq(vouchers.status, 'active')))

    const codeSet = new Set(existingCodes.map((v: any) => v.code))
    let result = ''
    let attempts = 0
    while (attempts < 100) {
        result = ''
        for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
        if (!codeSet.has(result)) return result
        attempts++
    }
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}
