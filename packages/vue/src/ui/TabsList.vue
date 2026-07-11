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
  border-radius: calc(var(--xpe-radius, 12px) * 0.66);
  padding: 3px;
}
</style>
