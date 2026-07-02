from playwright.sync_api import sync_playwright
import os

SCREENSHOTS_DIR = r'e:\cwh\project\homecare-agent\apps\web\screenshots'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})

    # 1. Navigate to root - AuthGuard will redirect to /login after hydration
    page.goto('http://localhost:3000')
    page.wait_for_url('**/login', timeout=10000)
    page.wait_for_selector('input[type="text"]', timeout=10000)
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '01-login.png'), full_page=True)
    print('URL:', page.url)

    # 2. Fill login form using the demo account button
    demo_btn = page.locator('button:has-text("home_a")')
    if demo_btn.count() > 0:
        demo_btn.first.click()
        page.wait_for_timeout(300)
    else:
        page.locator('input[type="text"]').fill('home_a')
        page.locator('input[type="password"]').fill('home123456')

    page.locator('button[type="submit"]').click()

    # Wait for redirect to /
    page.wait_for_url('**/', timeout=10000)
    page.wait_for_selector('textarea', timeout=10000)
    page.wait_for_timeout(1000)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '02-agent-home.png'), full_page=True)
    print('URL after login:', page.url)

    # 3. Check Agent Home elements
    print('\n--- Agent Home ---')
    print('h1:', page.locator('h1').all_text_contents())
    print('h2:', page.locator('h2').all_text_contents())
    menu_sel = 'button[aria-label="打开菜单"]'
    newtask_sel = 'button[aria-label="新任务"]'
    plus_sel = 'button[aria-label="添加资料"]'
    print('menu btn:', page.locator(menu_sel).count())
    print('new task btn:', page.locator(newtask_sel).count())
    print('plus btn:', page.locator(plus_sel).count())
    print('textarea:', page.locator('textarea').count())
    sugg = page.locator('button:has-text("上传订单"), button:has-text("滤芯"), button:has-text("保修期"), button:has-text("扫地机器人")')
    print('quick suggestions:', sugg.count())

    # 4. Click a quick suggestion to test agent flow
    page.locator('button:has-text("上传订单")').click()
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, '03-create-device.png'), full_page=True)
    print('\nAfter suggestion click:')
    print('  cards:', page.locator('.card').count())
    print('  buttons:', page.locator('button').all_text_contents())

    browser.close()
    print('\nDone!')
