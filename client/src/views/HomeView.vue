<template>
  <main class="home">
    <h1>Welcome to Wallet Tracker</h1>
    <p>Track and manage your Solana wallets efficiently</p>
    <div class="actions">
      <RouterLink to="/login" class="cta-button">Get Started</RouterLink>
    </div>
  </main>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}

.cta-button {
  display: inline-block;
  padding: 1rem 2rem;
  background: #4CAF50;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: bold;
}

.cta-button:hover {
  background: #45a049;
}
</style>
