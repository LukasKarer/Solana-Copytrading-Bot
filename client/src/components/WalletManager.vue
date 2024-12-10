<template>
  <div class="wallet-manager">
    <div class="status-panel" v-if="status">
      <div :class="['status-indicator', status.isActive ? 'active' : 'inactive']">
        Bot Status: {{ status.isActive ? 'Active' : 'Inactive' }}
      </div>
      <div class="stats">
        <p>Trades Copied: {{ status.tradesCopied }}</p>
        <p>Active Wallets: {{ status.activeWallets }}</p>
      </div>
    </div>

    <div class="wallet-form">
      <input 
        v-model="newWallet" 
        placeholder="Enter wallet address" 
        :class="{ error: walletError }"
      />
      <button @click="addWallet" :disabled="!newWallet">Add Wallet</button>
      <span class="error-message" v-if="walletError">{{ walletError }}</span>
    </div>
    
    <div class="watched-wallets">
      <h3>Watched Wallets</h3>
      <ul>
        <li v-for="wallet in watchedWallets" :key="wallet.address">
          {{ wallet.address }}
          <button @click="removeWallet(wallet.address)">Remove</button>
        </li>
      </ul>
    </div>

    <div class="token-config">
      <h3>Target Tokens</h3>
      <input 
        v-model="newToken" 
        placeholder="Enter token address"
        :class="{ error: tokenError }"
      />
      <button @click="addToken" :disabled="!newToken">Add Token</button>
      <span class="error-message" v-if="tokenError">{{ tokenError }}</span>
      <ul>
        <li v-for="token in targetTokens" :key="token">
          {{ token }}
          <button @click="removeToken(token)">Remove</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

const API_BASE_URL = /* process.env.VUE_APP_API_BASE_URL ||  */'http://localhost:3000/api';

export default {
  data() {
    return {
      newWallet: '',
      newToken: '',
      watchedWallets: [],
      targetTokens: [],
      status: null,
      walletError: '',
      tokenError: ''
    }
  },
  
  async created() {
    await this.loadInitialData();
    this.startStatusPolling();
  },

  beforeDestroy() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  },

  methods: {
    async loadInitialData() {
      try {
        const [walletsResponse, tokensResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/wallets`),
          axios.get(`${API_BASE_URL}/tokens`)
        ]);
        
        this.watchedWallets = walletsResponse.data.wallets;
        this.targetTokens = tokensResponse.data.tokens;
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    },

    startStatusPolling() {
      this.statusInterval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/status`);
          this.status = response.data;
        } catch (error) {
          console.error('Error fetching status:', error);
        }
      }, 5000); // Poll every 5 seconds
    },

    async addWallet() {
      try {
        this.walletError = '';
        const response = await axios.post(`${API_BASE_URL}/wallets`, {
          address: this.newWallet
        });
        
        if (response.data.success) {
          this.watchedWallets.push({ address: this.newWallet });
          this.newWallet = '';
        }
      } catch (error) {
        this.walletError = error.response?.data?.error || 'Failed to add wallet';
        console.error('Error adding wallet:', error);
      }
    },

    async removeWallet(address) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/wallets/${address}`);
        
        if (response.data.success) {
          this.watchedWallets = this.watchedWallets.filter(
            wallet => wallet.address !== address
          );
        }
      } catch (error) {
        console.error('Error removing wallet:', error);
      }
    },

    async addToken() {
      try {
        this.tokenError = '';
        const response = await axios.post(`${API_BASE_URL}/tokens`, {
          tokenAddress: this.newToken
        });
        
        if (response.data.success) {
          this.targetTokens.push(this.newToken);
          this.newToken = '';
        }
      } catch (error) {
        this.tokenError = error.response?.data?.error || 'Failed to add token';
        console.error('Error adding token:', error);
      }
    },

    async removeToken(token) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/tokens/${token}`);
        
        if (response.data.success) {
          this.targetTokens = this.targetTokens.filter(t => t !== token);
        }
      } catch (error) {
        console.error('Error removing token:', error);
      }
    }
  }
}
</script>

<style scoped>
.status-indicator {
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.status-indicator.active {
  background-color: #4CAF50;
  color: white;
}

.status-indicator.inactive {
  background-color: #f44336;
  color: white;
}

.error {
  border-color: red;
}

.error-message {
  color: red;
  font-size: 0.8em;
  margin-top: 5px;
}

/* Add more styling as needed */
</style> 