import { defineStore } from 'pinia'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key'

export const useCommonStore = defineStore('common', {
  state: () => ({
    encryptedPrivateKey: localStorage.getItem('encryptedPrivateKey') || '',
    maxWsolPerTrade: Number(localStorage.getItem('maxWsolPerTrade')) || 0.001,
  }),

  actions: {
    setPrivateKey(privateKey: string) {
      const encrypted = CryptoJS.AES.encrypt(privateKey, ENCRYPTION_KEY).toString()
      this.encryptedPrivateKey = encrypted
      localStorage.setItem('encryptedPrivateKey', encrypted)
    },

    getPrivateKey(): string {
      if (!this.encryptedPrivateKey) return ''
      const decrypted = CryptoJS.AES.decrypt(this.encryptedPrivateKey, ENCRYPTION_KEY)
      return decrypted.toString(CryptoJS.enc.Utf8)
    },

    setMaxWsol(amount: number) {
      this.maxWsolPerTrade = amount
      localStorage.setItem('maxWsolPerTrade', amount.toString())
    },
  },
}) 