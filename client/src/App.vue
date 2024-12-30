<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'

import NavigationMenu from './components/ui/navigation-menu/NavigationMenu.vue';
import NavigationMenuList from './components/ui/navigation-menu/NavigationMenuList.vue';
import NavigationMenuItem from './components/ui/navigation-menu/NavigationMenuItem.vue';
import NavigationMenuLink from './components/ui/navigation-menu/NavigationMenuLink.vue';

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = async () => {
  await authStore.signOut()
  router.push('/')
}
</script>

<template>
  <header class="border-b">
    <NavigationMenu class="max-w-screen-xl mx-auto px-4">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <RouterLink to="/" class="navigation-link">Home</RouterLink>
          </NavigationMenuLink>
        </NavigationMenuItem>
        
        <template v-if="authStore.isAuthenticated">
          <NavigationMenuItem>
            <NavigationMenuLink asChild>
              <RouterLink to="/wallets" class="navigation-link">Wallets</RouterLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink asChild>
              <a href="#" @click.prevent="handleLogout" class="navigation-link">Logout</a>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </template>
        
        <NavigationMenuItem v-else>
          <NavigationMenuLink asChild>
            <RouterLink to="/login" class="navigation-link">Login</RouterLink>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
      <ThemeToggle />
    </NavigationMenu>
  </header>

  <RouterView />
</template>

<style scoped>
.navigation-link {
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
}
</style>
