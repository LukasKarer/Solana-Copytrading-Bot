<template>
  <main class="flex flex-col items-center justify-center min-h-[80vh] px-4">
    <div class="text-center space-y-6">
      <h1 class="text-4xl font-bold tracking-tight">Welcome to P&L Guardian</h1>
      <p class="text-lg text-muted-foreground">
        Track, manage and copytrade Solana wallets efficiently
      </p>
      <div>
        <RouterLink to="/login">
          <Button size="lg">Get Started</Button>
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>
