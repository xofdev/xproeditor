<template>
  <div class="xpe-tabs-list">
    <slot />
  </div>
</template>

<style scoped>
.xpe-tabs-list {
  display: grid;
  gap: 4px;
  background: var(--xpe-muted, #f3f4f6);
  border-radius: 8px;
  padding: 3px;
}
</style>
