// 获取 DOM 元素
const form = document.getElementById('registration-form');
const lastNameInput = document.getElementById('last-name');
const firstNameInput = document.getElementById('first-name');
const usernameInput = document.getElementById('username'); // 新增：获取用户名输入框
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const recoveryEmailInput = document.getElementById('recovery-email');
// const resultMessage = document.getElementById('result-message'); // 移除 resultMessage 引用
const loadingIndicator = document.getElementById('loading-indicator');

// 表单提交事件监听器
form.addEventListener('submit', async (event) => {
    event.preventDefault(); // 阻止默认表单提交

    // 基本前端验证
    const lastName = lastNameInput.value.trim();
    const firstName = firstNameInput.value.trim();
    const username = usernameInput.value.trim(); // 新增：获取用户名
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const recoveryEmail = recoveryEmailInput.value.trim();

    // 更新验证逻辑，包含用户名和必填的辅助邮箱
    if (!lastName || !firstName || !username || !password || !confirmPassword || !recoveryEmail) {
        Swal.fire({ // 使用 SweetAlert2
            icon: 'warning',
            title: '输入不完整',
            text: '请填写所有必填项。',
        });
        // 尝试聚焦第一个空字段 (简单实现)
        if (!lastName) lastNameInput.focus();
        else if (!firstName) firstNameInput.focus();
        else if (!username) usernameInput.focus();
        else if (!password) passwordInput.focus();
        else if (!confirmPassword) confirmPasswordInput.focus();
        else if (!recoveryEmail) recoveryEmailInput.focus();
        return;
    }

    // 新增：验证用户名格式 (小写字母, 数字, 点, 短横线)
    const usernameRegex = /^[a-z0-9.-]+$/;
    if (!usernameRegex.test(username)) {
        Swal.fire({ // 使用 SweetAlert2
            icon: 'warning',
            title: '用户名格式无效',
            text: '用户名只能包含小写字母、数字、点(.)和短横线(-)。',
        });
        usernameInput.focus();
        return;
    }

    if (password.length < 8) {
        Swal.fire({ // 使用 SweetAlert2
            icon: 'warning',
            title: '密码太短',
            text: '密码至少需要8位。',
        });
        passwordInput.focus();
        return;
    }

    if (password !== confirmPassword) {
        Swal.fire({ // 使用 SweetAlert2
            icon: 'warning',
            title: '密码不匹配',
            text: '两次输入的密码不匹配。',
        });
        confirmPasswordInput.focus();
        return;
    }

    // 显示加载指示器
    loadingIndicator.style.display = 'block';
    form.querySelector('button[type="submit"]').disabled = true; // 禁用按钮防止重复提交

    // --- 调用后端 API ---
    console.log('发送注册请求到后端:', { lastName, firstName, username, recoveryEmail }); // 添加 username 到日志

    try {
        const response = await fetch('/register', { // 使用相对路径，因为 server.js 会托管静态文件
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lastName,
                firstName,
                username, // 新增：将用户名发送到后端
                password, // 密码在传输时应使用 HTTPS
                recoveryEmail,
            }),
        });

        const data = await response.json(); // 解析后端返回的 JSON 数据

        if (response.ok && data.success) {
            // 注册成功 - 使用 SweetAlert2 显示
            Swal.fire({
                icon: 'success',
                title: '注册成功！',
                html: `您的用户名是: <strong>${data.username}</strong><br>学号是: <strong>${data.studentId}</strong><br><br>学号务必保存好。`, // 使用 html 属性加粗
                confirmButtonText: '好的'
            });
            form.reset(); // 清空表单
        } else {
            // 注册失败 (来自后端的消息) - 使用 SweetAlert2 显示
            Swal.fire({
                icon: 'error',
                title: '注册失败',
                text: data.message || '请稍后重试。',
            });
        }

    } catch (error) {
        // 网络错误或其他 fetch 错误
        console.error('调用注册 API 时出错:', error);
        // 网络错误或其他 fetch 错误 - 使用 SweetAlert2 显示
        Swal.fire({
            icon: 'error',
            title: '网络错误',
            text: '无法连接到注册服务，请检查网络或稍后重试。',
        });
    } finally {
        // 隐藏加载指示器并重新启用按钮
        loadingIndicator.style.display = 'none';
        form.querySelector('button[type="submit"]').disabled = false;
    }
});