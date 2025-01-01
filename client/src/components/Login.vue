<template>
  <div class="flex justify-center items-center min-h-[80vh] px-4">
    <Card class="w-full max-w-md">
      <CardHeader>
        <h2 class="text-2xl font-semibold text-center">
          {{ showOTPInput ? 'Enter Verification Code' : 'Login' }}
        </h2>
      </CardHeader>
      
      <form @submit.prevent="handleSubmit">
        <CardContent class="space-y-4">
          <template v-if="!showOTPInput">
            <Input
              v-model="email"
              type="email"
              placeholder="Email"
              required
            />
          </template>
          
          <template v-else>
            <p class="text-sm text-muted-foreground text-center">
              Please enter the verification code sent to {{ email }}
            </p>
            <Input
              v-model="otp"
              type="text"
              placeholder="Enter verification code"
              required
              pattern="[0-9]*"
              inputmode="numeric"
            />
          </template>
          
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </CardContent>

        <CardFooter class="flex flex-col gap-3">
          <Button type="submit" class="w-full">
            {{ showOTPInput ? 'Verify Code' : 'Send Login Link' }}
          </Button>
          
          <Button 
            v-if="showOTPInput" 
            type="button" 
            variant="outline"
            @click="resetForm"
            class="w-full"
          >
            Back to Email
          </Button>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

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