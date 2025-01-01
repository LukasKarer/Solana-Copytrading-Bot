<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/components/Header.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
body {
  display: block;
}
header {
  width: 100vw;
}
/*.navigation-link {
  display: block;
  padding: 0.75rem 1rem;
  text-decoration: none;
  transition: color 0.2s;
}

.navigation-link:hover {
  color: var(--primary);
}

.navigation-link.router-link-active {
  color: var(--primary);
  font-weight: 500;
}*/
</style>
