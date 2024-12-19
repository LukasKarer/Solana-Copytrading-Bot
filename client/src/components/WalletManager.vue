<template>
  <div class="wallet-manager">
    <div class="user-setup" v-if="!userId">
      <h2>User Setup</h2>
      <div class="input-group">
        <input 
          v-model="userIdInput"
          placeholder="Enter User ID"
          type="text"
        />
        <input 
          v-model="privateKeyInput"
          placeholder="Enter Private Key"
          type="text"
        />
        <input 
          v-model="maxWsolInput"
          placeholder="Max WSOL per trade"
          type="number"
          step="0.001"
        />
        <button @click="setUserDetails">Set User Details</button>
      </div>
      <p class="error" v-if="userError">{{ userError }}</p>
    </div>

    <div v-else class="wallet-controls">
      <h2>Wallet Manager</h2>
      <div class="user-info">
        <p>User ID: {{ userId }}</p>
        <p>Max WSOL per trade: {{ maxWsolPerTrade }}</p>
        <button @click="resetUserDetails">Change User</button>
      </div>

      <div class="input-group">
        <input 
          v-model="newWallet"
          placeholder="Enter wallet address"
          type="text"
        />
        <button @click="addWallet">Add Wallet</button>
      </div>
      <p class="error" v-if="walletError">{{ walletError }}</p>

      <div class="wallet-list">
        <h3>Watched Wallets</h3>
        <ul>
          <li v-for="wallet in watchedWallets" :key="wallet.address">
            {{ wallet.address }}
            <button @click="removeWallet(wallet.address)">Remove</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

export default defineComponent({
  name: 'WalletManager',
  
  data() {
    return {
      userId: '',
      privateKey: '',
      maxWsolPerTrade: 0.001,
      userIdInput: '',
      privateKeyInput: '',
      maxWsolInput: 0.001,
      newWallet: '',
      watchedWallets: [] as { address: string }[],
      walletError: '',
      userError: '',
      status: null as any,
      statusInterval: null as number | null,
    };
  },

  methods: {
    setUserDetails() {
      if (!this.userIdInput || !this.privateKeyInput || !this.maxWsolInput) {
        this.userError = 'All fields are required';
        return;
      }
      
      this.userId = this.userIdInput;
      this.privateKey = this.privateKeyInput;
      this.maxWsolPerTrade = this.maxWsolInput;
      this.userError = '';
      
      // Reset inputs
      this.userIdInput = '';
      this.privateKeyInput = '';
      this.maxWsolInput = 0.001;
    },

    resetUserDetails() {
      this.userId = '';
      this.privateKey = '';
      this.maxWsolPerTrade = 0.001;
      this.watchedWallets = [];
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }
    },

    async addWallet() {
      try {
        this.walletError = '';
        const response = await axios.post(`${API_BASE_URL}/wallets`, {
          address: this.newWallet,
          userId: this.userId,
          privateKey: this.privateKey,
          maxWsolPerTrade: this.maxWsolPerTrade
        });
        
        if (response.data.success) {
          this.watchedWallets.push({ address: this.newWallet });
          this.newWallet = '';
        }
      } catch (error: any) {
        this.walletError = error.response?.data?.error || 'Failed to add wallet';
      }
    },

    async removeWallet(address: string) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/wallets/${address}`, {
          data: {
            userId: this.userId
          }
        });
        
        if (response.data.success) {
          this.watchedWallets = this.watchedWallets.filter(w => w.address !== address);
        }
      } catch (error: any) {
        this.walletError = error.response?.data?.error || 'Failed to remove wallet';
      }
    },
  },
});
</script>

<style scoped>
.wallet-manager {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.input-group {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  flex: 1;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

.error {
  color: red;
  margin-top: 5px;
}

.wallet-list {
  margin-top: 20px;
}

.wallet-list ul {
  list-style: none;
  padding: 0;
}

.wallet-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.user-info {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.user-info button {
  background-color: #666;
  margin-top: 10px;
}

.user-info button:hover {
  background-color: #555;
}
</style> 