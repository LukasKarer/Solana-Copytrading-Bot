<template>
  <div class="login-container">
    <div class="login-box">
      <h2>{{ showOTPInput ? 'Enter Verification Code' : 'Login' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="input-group">
          <!-- Email input shown initially -->
          <template v-if="!showOTPInput">
            <input
              v-model="email"
              type="email"
              placeholder="Email"
              required
            />
          </template>
          
          <!-- OTP input shown after email submission -->
          <template v-else>
            <p class="info">Please enter the verification code sent to {{ email }}</p>
            <input
              v-model="otp"
              type="text"
              placeholder="Enter verification code"
              required
              pattern="[0-9]*"
              inputmode="numeric"
            />
          </template>
        </div>
        <p class="error" v-if="error">{{ error }}</p>
        <button type="submit">
          {{ showOTPInput ? 'Verify Code' : 'Send Login Link' }}
        </button>
        
        <!-- Back button when showing OTP input -->
        <button 
          v-if="showOTPInput" 
          type="button" 
          class="secondary-button"
          @click="resetForm"
        >
          Back to Email
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const otp = ref('')
const error = ref('')
const showOTPInput = ref(false)

const resetForm = () => {
  showOTPInput.value = false
  otp.value = ''
  error.value = ''
}

const handleSubmit = async () => {
  try {
    error.value = ''
    
    if (!showOTPInput.value) {
      // Send OTP email
      await authStore.signInWithOTP(email.value)
      showOTPInput.value = true
    } else {
      // Verify OTP
      await authStore.verifyOTP(email.value, otp.value)
      router.push('/wallets')
    }
  } catch (e: any) {
    if (e.message.includes('Email not confirmed')) {
      showOTPInput.value = true
    } else {
      error.value = e.message
      console.error(e)
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.login-box {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
}

input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #45a049;
}

.error {
  color: red;
  margin: 0.5rem 0;
}

.toggle-mode {
  margin-top: 1rem;
  text-align: center;
}

.toggle-mode a {
  color: #4CAF50;
  text-decoration: none;
}

.info {
  color: #666;
  margin-bottom: 1rem;
  text-align: center;
}

.secondary-button {
  margin-top: 1rem;
  background: #ffffff;
  color: #4CAF50;
  border: 1px solid #4CAF50;
}

.secondary-button:hover {
  background: #f5f5f5;
}
</style> 