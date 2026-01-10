export type Bindings = {
    DB: D1Database
    JWT_SECRET: string
    BUCKET: R2Bucket
}

export type Variables = {
    user: {
        id: number
        username: string
        phoneNumber?: string
        role: 'admin' | 'cashier' | 'customer'
        name: string
    }
}
