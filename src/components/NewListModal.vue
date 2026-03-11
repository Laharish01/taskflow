<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">New List</span>
        <button class="close-btn" @click="$emit('close')">
          <LucideIcon name="x" :size="14" />
        </button>
      </div>
      <div class="modal-body">
        <input v-model="name" placeholder="List name" class="name-input" @keydown.enter="create" ref="inputRef" />

        <div class="field-group">
          <span class="field-label">Color</span>
          <div class="color-row">
            <button v-for="c in colors" :key="c" class="color-swatch" :class="{ active: color === c }"
              :style="{ background: c }" @click="color = c" />
          </div>
        </div>

        <div class="field-group">
          <span class="field-label">Icon</span>
          <div class="icon-row">
            <button v-for="ic in icons" :key="ic" class="icon-btn" :class="{ active: icon === ic }" @click="icon = ic">{{ ic }}</button>
          </div>
        </div>

        <div class="preview">
          <span class="preview-dot" :style="{ background: color }" />
          <span class="preview-name">{{ name || 'Untitled' }}</span>
        </div>

        <div class="actions">
          <button class="cancel-btn" @click="$emit('close')">Cancel</button>
          <button class="create-btn" :disabled="!name.trim()" @click="create">Create list</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import LucideIcon from './LucideIcon.vue'

const emit = defineEmits<{ close: [] }>()
const store = useTaskStore()

const name = ref('')
const color = ref('#3b6cf8')
const icon = ref('📋')
const inputRef = ref<HTMLInputElement>()

const colors = ['#3b6cf8','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6']
const icons = ['📋','📁','🏠','💼','🎯','📚','🛒','💡','🎨','🏃','💊','✈️']

onMounted(() => inputRef.value?.focus())

function create() {
  if (!name.value.trim()) return
  const list = store.createList({ name: name.value.trim(), color: color.value, icon: icon.value })
  store.setView('list', list.id)
  emit('close')
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.25);
  display: grid; place-items: center;
  z-index: 200; padding: 20px;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--surface); border-radius: 14px;
  width: 100%; max-width: 340px;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 20px 0;
}
.modal-title { font-size: 15px; font-weight: 700; color: var(--text); }
.close-btn {
  border: none; background: none; cursor: pointer;
  color: var(--text3); padding: 6px; border-radius: 6px;
  display: grid; place-items: center; min-width: 30px; min-height: 30px;
  transition: background 0.1s;
}
.close-btn:hover { background: var(--surface2); color: var(--text); }
.modal-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 14px; }

.name-input {
  border: 1px solid var(--border); border-radius: 9px;
  padding: 10px 13px; font-size: 14px; outline: none;
  width: 100%; color: var(--text); background: var(--bg);
  font-family: var(--font);
}
.name-input:focus { border-color: var(--accent); background: var(--surface); }

.field-group { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.06em; }

.color-row { display: flex; gap: 7px; flex-wrap: wrap; }
.color-swatch {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2.5px solid transparent; cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
  outline: none;
}
.color-swatch.active { border-color: var(--text); transform: scale(1.15); }

.icon-row { display: flex; gap: 5px; flex-wrap: wrap; }
.icon-btn {
  width: 32px; height: 32px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface); cursor: pointer;
  font-size: 15px; display: grid; place-items: center; transition: all 0.1s;
}
.icon-btn.active, .icon-btn:hover { border-color: var(--accent); background: var(--accent-bg); }

.preview {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: var(--bg);
  border-radius: 9px; border: 1px solid var(--border2);
}
.preview-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.preview-name { font-size: 13.5px; font-weight: 500; color: var(--text2); }

.actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; }
.cancel-btn {
  padding: 8px 16px; border: 1px solid var(--border); background: var(--surface);
  border-radius: 8px; font-size: 13px; cursor: pointer; color: var(--text2);
  font-family: var(--font); transition: background 0.1s;
}
.cancel-btn:hover { background: var(--bg); }
.create-btn {
  padding: 8px 16px; background: var(--text); color: white;
  border: none; border-radius: 8px; font-size: 13px;
  cursor: pointer; font-weight: 500; font-family: var(--font);
  transition: background 0.1s;
}
.create-btn:hover { background: #2d2d30; }
.create-btn:disabled { background: var(--border); color: var(--text3); cursor: not-allowed; }
</style>
