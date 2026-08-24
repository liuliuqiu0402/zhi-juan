import { ref, nextTick } from 'vue';

// ==================== 模块级共享状态（单例模式） ====================
// 所有 useDialog() 调用共享同一组状态，确保只有一个对话框实例

// 输入对话框
const showInputDialog = ref(false);
const inputDialogTitle = ref('');
const inputDialogValue = ref('');
const inputDialogCallback = ref(null);
const inputDialogRef = ref(null);

// 确认对话框
const showConfirmDialog = ref(false);
const confirmDialogMessage = ref('');
const confirmDialogCallback = ref(null);

// 提示对话框
const showAlertDialog = ref(false);
const alertDialogMessage = ref('');
const alertDialogCallback = ref(null);

// 重试对话框（三按钮：重试 / 批量生成 / 取消）
const showRetryDialog = ref(false);
const retryDialogMessage = ref('');
const retryDialogCallback = ref(null);

// 🔧 单选对话框（单选选项 + 确定/取消）
const showRadioDialog = ref(false);
const radioDialogMessage = ref('');
const radioDialogOptions = ref([]);  // [{ label: '合并为一份综合资料', value: 'merge' }, ...]
const radioDialogSelected = ref('');
const radioDialogCallback = ref(null);

export function useDialog() {
  const showInputDialogFn = (title, defaultValue = '') => {
    return new Promise((resolve) => {
      inputDialogTitle.value = title;
      inputDialogValue.value = defaultValue;
      inputDialogCallback.value = resolve;
      showInputDialog.value = true;
      nextTick(() => {
        if (inputDialogRef.value) {
          inputDialogRef.value.focus();
          inputDialogRef.value.select();
        }
      });
    });
  };

  const confirmInputDialog = () => {
    const value = inputDialogValue.value;
    showInputDialog.value = false;
    if (inputDialogCallback.value) {
      inputDialogCallback.value(value);
      inputDialogCallback.value = null;
    }
  };

  const cancelInputDialog = () => {
    showInputDialog.value = false;
    if (inputDialogCallback.value) {
      inputDialogCallback.value(null);
      inputDialogCallback.value = null;
    }
  };

  const showConfirmDialogFn = (message) => {
    // 如果已有对话框显示中，先关闭旧的防止回调丢失
    if (showConfirmDialog.value && confirmDialogCallback.value) {
      confirmDialogCallback.value(false);
      confirmDialogCallback.value = null;
    }
    return new Promise((resolve) => {
      confirmDialogMessage.value = message;
      confirmDialogCallback.value = resolve;
      showConfirmDialog.value = true;
    });
  };

  const confirmConfirmDialog = () => {
    showConfirmDialog.value = false;
    if (confirmDialogCallback.value) {
      confirmDialogCallback.value(true);
      confirmDialogCallback.value = null;
    }
  };

  const cancelConfirmDialog = () => {
    showConfirmDialog.value = false;
    if (confirmDialogCallback.value) {
      confirmDialogCallback.value(false);
      confirmDialogCallback.value = null;
    }
  };

  const showAlertDialogFn = (message) => {
    // 如果已有对话框显示中，先关闭旧的防止回调丢失
    if (showAlertDialog.value && alertDialogCallback.value) {
      alertDialogCallback.value();
      alertDialogCallback.value = null;
    }
    return new Promise((resolve) => {
      alertDialogMessage.value = message;
      alertDialogCallback.value = resolve;
      showAlertDialog.value = true;
    });
  };

  const closeAlertDialog = () => {
    showAlertDialog.value = false;
    if (alertDialogCallback.value) {
      alertDialogCallback.value();
      alertDialogCallback.value = null;
    }
  };

  // ===== 重试对话框（三按钮） =====
  const showRetryDialogFn = (message) => {
    if (showRetryDialog.value && retryDialogCallback.value) {
      retryDialogCallback.value('cancel');
      retryDialogCallback.value = null;
    }
    return new Promise((resolve) => {
      retryDialogMessage.value = message;
      retryDialogCallback.value = resolve;
      showRetryDialog.value = true;
    });
  };

  const chooseRetry = () => {
    showRetryDialog.value = false;
    if (retryDialogCallback.value) {
      retryDialogCallback.value('retry');
      retryDialogCallback.value = null;
    }
  };

  const cancelRetry = () => {
    showRetryDialog.value = false;
    if (retryDialogCallback.value) {
      retryDialogCallback.value('cancel');
      retryDialogCallback.value = null;
    }
  };

  // ===== 单选对话框 =====
  const showRadioDialogFn = (message, options, defaultVal) => {
    return new Promise((resolve) => {
      radioDialogMessage.value = message;
      radioDialogOptions.value = options;
      radioDialogSelected.value = defaultVal || (options[0]?.value || '');
      radioDialogCallback.value = resolve;
      showRadioDialog.value = true;
    });
  };

  const confirmRadioDialog = () => {
    showRadioDialog.value = false;
    if (radioDialogCallback.value) {
      radioDialogCallback.value(radioDialogSelected.value);
      radioDialogCallback.value = null;
    }
  };

  const cancelRadioDialog = () => {
    showRadioDialog.value = false;
    if (radioDialogCallback.value) {
      radioDialogCallback.value(null);
      radioDialogCallback.value = null;
    }
  };

  return {
    showInputDialog,
    inputDialogTitle,
    inputDialogValue,
    inputDialogRef,
    showInputDialogFn,
    confirmInputDialog,
    cancelInputDialog,
    showConfirmDialog,
    confirmDialogMessage,
    showConfirmDialogFn,
    confirmConfirmDialog,
    cancelConfirmDialog,
    showAlertDialog,
    alertDialogMessage,
    showAlertDialogFn,
    closeAlertDialog,
    // 重试对话框
    showRetryDialog,
    retryDialogMessage,
    showRetryDialogFn,
    chooseRetry,
    cancelRetry,
    // 单选对话框
    showRadioDialog,
    radioDialogMessage,
    radioDialogOptions,
    radioDialogSelected,
    showRadioDialogFn,
    confirmRadioDialog,
    cancelRadioDialog
  };
}