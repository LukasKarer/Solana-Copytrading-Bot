import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    session: null,
    loading: true
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.user,
    access_token: (state) => state.session?.access_token
  },
  
  actions: {
    async signInWithOTP(email: string) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/wallets`
        }
      })
      
      if (error) throw error
    },
    
    async verifyOTP(email: string, token: string) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })
      
      if (error) throw error
      this.user = data.user
      this.session = data.session
    },
    
    async signOut() {
      await supabase.auth.signOut()
      this.user = null
      this.session = null
    },
    
    async initializeAuth() {
      this.loading = true
      const { data } = await supabase.auth.getSession()
      this.user = data.session?.user ?? null
      this.session = data.session
      this.loading = false
      
      supabase.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user ?? null
        this.session = session
      })
    }
  },
  
  persist: true
}) 