param([ValidateSet('Protect','Unprotect','Prompt')][string]$Action)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    if ($Action -eq 'Prompt') {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $form = New-Object System.Windows.Forms.Form
        $form.Text = '方向卡 - 本机 API 凭据'
        $form.Size = New-Object System.Drawing.Size(480,310)
        $form.StartPosition = 'CenterScreen'
        $form.FormBorderStyle = 'FixedDialog'
        $form.MaximizeBox = $false
        $label = New-Object System.Windows.Forms.Label
        $label.Text = '仅在本机处理，不上传到项目网站。请选择服务商：'
        $label.Location = New-Object System.Drawing.Point(20,20)
        $label.Size = New-Object System.Drawing.Size(430,30)
        $form.Controls.Add($label)
        $provider = New-Object System.Windows.Forms.ComboBox
        $provider.DropDownStyle = 'DropDownList'
        $provider.Items.AddRange(@('DeepSeek','ChatGPT','Tavily'))
        $provider.SelectedIndex = 0
        $provider.Location = New-Object System.Drawing.Point(20,55)
        $provider.Width = 420
        $form.Controls.Add($provider)
        $key = New-Object System.Windows.Forms.TextBox
        $key.UseSystemPasswordChar = $true
        $key.MaxLength = 8192
        $key.Location = New-Object System.Drawing.Point(20,95)
        $key.Width = 420
        $form.Controls.Add($key)
        $remember = New-Object System.Windows.Forms.CheckBox
        $remember.Text = '在本机安全保存（绑定当前 Windows 账户）'
        $remember.Checked = $false
        $remember.Location = New-Object System.Drawing.Point(20,135)
        $remember.Width = 425
        $form.Controls.Add($remember)
        $hint = New-Object System.Windows.Forms.Label
        $hint.Text = '默认仅当前后台进程有效；空白提交将移除所选凭据。'
        $hint.Location = New-Object System.Drawing.Point(20,170)
        $hint.Size = New-Object System.Drawing.Size(430,35)
        $form.Controls.Add($hint)
        $ok = New-Object System.Windows.Forms.Button
        $ok.Text = '确认'
        $ok.Location = New-Object System.Drawing.Point(250,215)
        $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Controls.Add($ok)
        $cancel = New-Object System.Windows.Forms.Button
        $cancel.Text = '取消'
        $cancel.Location = New-Object System.Drawing.Point(350,215)
        $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $form.Controls.Add($cancel)
        $form.AcceptButton = $ok
        $form.CancelButton = $cancel
        if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }
        $names = @('DEEPSEEK_API_KEY','OPENAI_API_KEY','TAVILY_API_KEY')
        @{ name=$names[$provider.SelectedIndex]; key=$key.Text.Trim(); remember=$remember.Checked } | ConvertTo-Json -Compress
        $key.Clear()
        $form.Dispose()
    } else {
        Add-Type -AssemblyName System.Security
        $inputText = [Console]::In.ReadToEnd()
        $scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
        if ($Action -eq 'Protect') {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($inputText)
            $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope)
            [Console]::Out.Write([Convert]::ToBase64String($encrypted))
            [Array]::Clear($bytes,0,$bytes.Length)
        } else {
            $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($inputText.Trim()),$null,$scope)
            [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($bytes))
            [Array]::Clear($bytes,0,$bytes.Length)
        }
    }
} catch { [Console]::Error.Write('Credential operation failed.'); exit 1 }
