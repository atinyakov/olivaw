import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('monitors and inspects live robots', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Fleet health, at a glance.' }),
  ).toBeVisible();
  await expect(page.getByText('Live telemetry')).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'List', exact: true }).click();
  }

  await expect(
    page.getByRole('button', { name: /Open details for Ada/ }),
  ).toBeVisible();

  await page.getByPlaceholder('Search robots').fill('Ada');
  const adaButton = page.getByRole('button', { name: /Open details for Ada/ });
  await adaButton.click();
  await expect(page.getByRole('dialog', { name: 'Ada' })).toBeVisible();
  await expect(page.getByText('Current task')).toBeVisible();
  const initialPosition = await page
    .getByTestId('robot-position')
    .textContent();
  await expect
    .poll(() => page.getByTestId('robot-position').textContent())
    .not.toBe(initialPosition);
  await page.getByRole('button', { name: 'Close robot details' }).click();
  await expect(adaButton).toBeFocused();

  await page.getByLabel('Site').selectOption('hamburg-hub');
  await expect(
    page.getByRole('heading', { name: 'Hamburg Distribution Hub' }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('recovers when the live endpoint is temporarily unavailable', async ({
  page,
}) => {
  await page.route('**/api/v1/events', (route) =>
    route.abort('connectionfailed'),
  );
  await page.goto('/');
  await expect(page.getByText(/reconnecting|unavailable/i)).toBeVisible();
  await page.unroute('**/api/v1/events');

  await expect(page.getByText('Live telemetry')).toBeVisible({
    timeout: 15_000,
  });
});

test('has no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Live telemetry')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
});
