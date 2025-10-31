// 这个脚本用于处理图像上传的覆盖层

const overlay = document.createElement('div'); // 创建一个覆盖层元素
overlay.className = 'overlay'; // 设置覆盖层的类名

// 移除点击关闭 overlay 的监听器
// overlay.addEventListener('click', closeOverlay);

const retryButton = document.createElement('button'); // 创建重拍按钮
retryButton.textContent = '重拍'; // 设置按钮文本
retryButton.style.padding = '80px'; // 将水平内边距设置为80px

const confirmButton = document.createElement('button'); // 创建确认按钮
confirmButton.textContent = '确认'; // 设置按钮文本
confirmButton.style.padding = '80px'; // 将水平内边距设置为80px

overlay.appendChild(retryButton); // 将重拍按钮添加到覆盖层
overlay.appendChild(confirmButton); // 将确认按钮添加到覆盖层

document.body.appendChild(overlay); // 将覆盖层添加到文档中

// 关闭覆盖层的函数
function closeOverlay() {
    document.body.removeChild(overlay); // 从文档中移除覆盖层
}