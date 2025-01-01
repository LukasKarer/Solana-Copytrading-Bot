<template>
  <div class="wallet-manager">
    <Card class="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Wallet Manager</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div class="settings-group space-y-6">
          <h3 class="text-lg font-semibold">Trading Settings</h3>
          
          <div class="grid gap-4">
            <div class="grid gap-2">
              <Label for="privateKey">Private Key</Label>
              <Input 
                id="privateKey"
                v-model="privateKey"
                placeholder="Enter Private Key"
              />
            </div>
            
            <div class="grid gap-2">
              <Label for="maxWsol">SOL per trade</Label>
              <Input 
                id="maxWsol"
                v-model="maxWsolInput"
                placeholder="Max WSOL per trade"
                type="number"
                step="0.001"
              />
            </div>

            <div class="grid gap-2">
              <Label for="slippage">Slippage (%)</Label>
              <Input 
                id="slippage"
                v-model="slippagePercent"
                placeholder="Slippage percentage"
                type="number"
                min="0.01"
                max="10"
                step="0.01"
              />
            </div>

            <div class="grid gap-2">
              <Label for="feeType">Transaction Fee</Label>
              <Select v-model="feeType">
                <SelectTrigger>
                  <SelectValue placeholder="Select fee type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="feeType === 'custom'" class="grid gap-2">
              <Label for="customFee">Transaction Fee (Lamports)</Label>
              <Input 
                id="customFee"
                v-model="customComputeUnitPrice"
                type="number"
                placeholder="Enter custom fee"
                min="1"
              />
            </div>

            <Button @click="saveSettings" variant="default">Save Settings</Button>
          </div>

          <p class="text-sm text-muted-foreground">Default slippage is 0.5%</p>
          <p v-if="feeType === 'custom'" class="text-sm text-muted-foreground">
            1 SOL = 1 billion lamports
          </p>
          <p v-if="settingsError" class="text-sm text-destructive">{{ settingsError }}</p>
        </div>

        <Separator class="my-6" />

        <div class="space-y-4">
          <div class="grid gap-4">
            <div class="grid gap-2">
              <Label for="newWallet">Wallet Address</Label>
              <div class="flex gap-2 items-center">
                <Input 
                  id="newWallet"
                  v-model="newWallet"
                  placeholder="Enter wallet address"
                />
                <Button @click="addWallet" variant="default">Add Wallet</Button>
              </div>
            </div>
          </div>
          <p v-if="walletError" class="text-sm text-destructive">{{ walletError }}</p>

          <div class="space-y-2">
            <h3 class="text-lg font-semibold">Watched Wallets</h3>
            <div class="space-y-2">
              <div v-for="wallet in watchedWallets" 
                   :key="wallet" 
                   class="flex items-center justify-between p-2 border rounded-lg">
                <span class="text-sm">{{ wallet }}</span>
                <Button @click="removeWallet(wallet)" variant="destructive" size="sm">
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import Button from '@/components/ui/button/Button.vue';
import Input from '@/components/ui/input/Input.vue';
import Label from '@/components/ui/label/Label.vue';
import Select from '@/components/ui/select/Select.vue';
import SelectContent from '@/components/ui/select/SelectContent.vue';
import SelectItem from '@/components/ui/select/SelectItem.vue';
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue';
import SelectValue from '@/components/ui/select/SelectValue.vue';
import Separator from '@/components/ui/separator/Separator.vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const authStore = useAuthStore();

// State
const loading = ref(true);
const privateKey = ref('');
const maxWsolInput = ref(0.001);
const newWallet = ref('');
const watchedWallets = ref<string[]>([]);
const walletError = ref('');
const settingsError = ref('');
const slippagePercent = ref(0.5);
const feeType = ref('auto');
const customComputeUnitPrice = ref(1000);

// API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${authStore.session?.access_token}`
  }
});

// Computed properties
const computeUnitPrice = computed(() => 
  feeType.value === 'auto' ? 'auto' : Number(customComputeUnitPrice.value)
);

const slippageBps = computed(() => 
  Math.round(slippagePercent.value * 100)
);

// Methods
const saveSettings = async () => {
  try {
    settingsError.value = '';
    if (!privateKey.value || !maxWsolInput.value || !slippagePercent.value) {
      settingsError.value = 'All fields are required';
      return;
    }

    const response = await api.post('/settings', {
      privateKey: privateKey.value,
      maxWsolPerTrade: maxWsolInput.value,
      slippageBps: slippageBps.value,
      computeUnitPrice: computeUnitPrice.value
    });

    if (response.data.success) {
      console.log('Settings saved successfully');
      privateKey.value = '';
    }
  } catch (error: any) {
    settingsError.value = error.response?.data?.error || 'Failed to save settings';
  }
};

const fetchWallets = async () => {
  try {
    loading.value = true;
    const response = await api.get('/wallets');
    if (response.data.success) {
      watchedWallets.value = response.data.wallets;
    }
  } catch (error: any) {
    walletError.value = error.response?.data?.error || 'Failed to load wallets';
  } finally {
    loading.value = false;
  }
};

const addWallet = async () => {
  try {
    walletError.value = '';
    if (!newWallet.value) {
      walletError.value = 'Wallet address is required';
      return;
    }

    const response = await api.post('/wallets', {
      address: newWallet.value
    });
    
    if (response.data.success) {
      watchedWallets.value.push(newWallet.value);
      newWallet.value = '';
    }
  } catch (error: any) {
    walletError.value = error.response?.data?.error || 'Failed to add wallet';
  }
};

const removeWallet = async (address: string) => {
  try {
    walletError.value = '';
    const response = await api.delete(`/wallets/${address}`);
    
    if (response.data.success) {
      watchedWallets.value = watchedWallets.value.filter(w => w !== address);
    }
  } catch (error: any) {
    walletError.value = error.response?.data?.error || 'Failed to remove wallet';
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchWallets();
});
</script>

<style scoped>
.wallet-manager {
  padding: 20px;
}
</style> 