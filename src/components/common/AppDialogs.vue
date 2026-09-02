<template>
  <Teleport to="body">
    <!-- 输入对话框 -->
    <div
      v-if="showInputDialog"
      class="modal-mask"
      @click.self="cancelInputDialog"
    >
      <div
        class="modal"
        style="max-width: 500px;"
      >
        <h3>{{ inputDialogTitle }}</h3>
        <textarea
          ref="inputDialogRef"
          v-model="inputDialogValue"
          style="margin: 16px 0; min-height: 200px; width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit; box-sizing: border-box;"
        />
        <div class="modal-actions">
          <button
            class="btn"
            @click="cancelInputDialog"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="confirmInputDialog"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <div
      v-if="showConfirmDialog"
      class="modal-mask"
      @click.self="cancelConfirmDialog"
    >
      <div
        class="modal"
        style="max-width: 400px;"
      >
        <h3>确认</h3>
        <p style="margin: 16px 0; white-space: pre-line;">
          {{ confirmDialogMessage }}
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            @click="cancelConfirmDialog"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="confirmConfirmDialog"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 提示对话框 -->
    <div
      v-if="showAlertDialog"
      class="modal-mask"
      @click.self="closeAlertDialog"
    >
      <div
        class="modal"
        style="max-width: 500px;"
      >
        <h3>提示</h3>
        <p style="margin: 16px 0; white-space: pre-line; max-height: 400px; overflow-y: auto;">
          {{ alertDialogMessage }}
        </p>
        <div class="modal-actions">
          <button
            class="btn-primary"
            @click="closeAlertDialog"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 重试对话框（三按钮） -->
    <div
      v-if="showRetryDialog"
      class="modal-mask"
      @click.self="cancelRetry"
    >
      <div
        class="modal"
        style="max-width: 480px;"
      >
        <h3>⚠️ 生成失败</h3>
        <p style="margin: 16px 0; white-space: pre-line; max-height: 300px; overflow-y: auto;">
          {{ retryDialogMessage }}
        </p>
        <div
          class="modal-actions"
          style="flex-wrap: wrap; gap: 8px;"
        >
          <button
            class="btn"
            @click="cancelRetry"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="chooseRetry"
          >
            🔄 原样重试
          </button>
        </div>
      </div>
    </div>

    <!-- 单选对话框 -->
    <div
      v-if="showRadioDialog"
      class="modal-mask"
      @click.self="cancelRadioDialog"
    >
      <div
        class="modal"
        style="max-width: 440px;"
      >
        <h3>生成方式</h3>
        <p style="margin: 12px 0; white-space: pre-line; color: #666;">
          {{ radioDialogMessage }}
        </p>
        <div style="margin: 8px 0 16px;">
          <label
            v-for="opt in radioDialogOptions"
            :key="opt.value"
            style="display: flex; align-items: center; padding: 10px 14px; margin-bottom: 6px;
                   border: 1.5px solid #e0e0e0; border-radius: 10px; cursor: pointer;
                   transition: all 0.15s;"
            :style="radioDialogSelected === opt.value
              ? { borderColor: 'var(--primary-light)', background: '#f0f6ff' }
              : {}"
            @click="radioDialogSelected = opt.value"
          >
            <span
              style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ccc;
                         display: inline-flex; align-items: center; justify-content: center; margin-right: 10px;
                         flex-shrink: 0;"
              :style="radioDialogSelected === opt.value
                ? { borderColor: 'var(--primary-light)' }
                : {}"
            >
              <span
                v-if="radioDialogSelected === opt.value"
                style="width: 10px; height: 10px; border-radius: 50%; background: var(--primary-light);"
              />
            </span>
            <span style="font-size: 14px;">{{ opt.label }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="cancelRadioDialog"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="confirmRadioDialog"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useDialog } from '@/composables/useDialog.js';

const {
  showInputDialog,
  inputDialogTitle,
  inputDialogValue,
  inputDialogRef,
  confirmInputDialog,
  cancelInputDialog,
  showConfirmDialog,
  confirmDialogMessage,
  confirmConfirmDialog,
  cancelConfirmDialog,
  showAlertDialog,
  alertDialogMessage,
  closeAlertDialog,
  showRetryDialog,
  retryDialogMessage,
  chooseRetry,
  cancelRetry,
  showRadioDialog,
  radioDialogMessage,
  radioDialogOptions,
  radioDialogSelected,
  confirmRadioDialog,
  cancelRadioDialog
} = useDialog();
</script>

<style scoped>
.modal-mask {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: transparent; display: flex; align-items: center;
  justify-content: center; z-index: 3500; pointer-events: none;
}

.modal {
  background: white; border-radius: 16px; padding: 28px 32px;
  min-width: 450px; max-width: 650px; max-height: 82vh; overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.16);
  border: 2px solid var(--border); pointer-events: auto; position: relative;
}

.modal::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
  background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%);
  border-radius: 14px 14px 0 0;
}

.modal h3 {
  font-size: 18px; color: var(--primary); margin-bottom: 24px;
  padding-bottom: 14px; border-bottom: 2px solid var(--primary-lighter);
}

.modal-actions {
  display: flex; gap: 12px; justify-content: flex-end;
  margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--primary-lighter);
}

/* 📱 移动端弹窗适配 */
@media (max-width: 767px) {
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .modal {
    min-width: 0 !important;
    width: 90vw !important;
    max-width: 90vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
  }
  .modal::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .modal h3 {
    font-size: 15px !important;
    margin-bottom: 12px !important;
    padding-bottom: 10px !important;
  }
  .modal p {
    font-size: 13px !important;
    margin: 10px 0 !important;
    max-height: 50vh !important;
  }
  .modal-actions {
    margin-top: 12px !important;
    padding-top: 12px !important;
    gap: 8px !important;
    flex-wrap: wrap;
  }
  .modal-actions .btn,
  .modal-actions .btn-primary {
    flex: 1;
    font-size: 13px;
    padding: 10px 6px;
    text-align: center;
    min-height: 40px;
    white-space: nowrap;
  }
  /* 单选选项字体 */
  .modal label span {
    font-size: 13px !important;
  }
}
</style>
