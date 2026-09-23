#!/usr/bin/env node
/* 
  Sitemap Generator for Dear IT BD Customer Site
  Run: node generate-sitemap.js
  Outputs: sitemap.xml in project root
*/

const fs = require('fs');
const path = require('path');

// Configuration - FIXED: env var or package.json theke nite parbe
const SITE_URL = process.env.SITE_URL || process.env.URL || 'https://shop.dearitbd.com'; // Netlify URL env var, na hole default
const LAST_MOD = new Date().toISOString().split('T')[0];

// Static pages that always exist
const staticPages = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/customer.html', changefreq: 'daily', priority: 1.0 },
];

// Generate sitemap XML
function generateSitemap(productUrls = []) {
  const urls = [
    ...staticPages,
    ...productUrls.map(p => ({
      url: `/customer.html?p=${p.id}`,
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: p.updatedAt || LAST_MOD
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(page => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${page.lastmod || LAST_MOD}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${page.url}"/>
    <xhtml:link rel="alternate" hreflang="bn" href="${SITE_URL}${page.url}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${page.url}"/>
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

// If running directly (not imported), generate from localStorage/JSON
if (require.main === module) {
  // Try to read products from a local JSON file (exported from admin)
  let products = [];
  
  const productsPath = path.join(__dirname, 'products.json');
  if (fs.existsSync(productsPath)) {
    try {
      products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      console.log(`Found ${products.length} products in products.json`);
    } catch (e) {
      console.warn('Could not parse products.json:', e.message);
    }
  } else {
    console.log('No products.json found - generating sitemap with static pages only');
    console.log('To include products: export products from admin panel as products.json in project root');
  }

  const sitemap = generateSitemap(products);
  const outputPath = path.join(__dirname, 'sitemap.xml');
  fs.writeFileSync(outputPath, sitemap);
  console.log(`✅ Sitemap generated: ${outputPath}`);
  console.log(`📋 Submit to Google Search Console: ${SITE_URL}/sitemap.xml`);
}

module.exports = { generateSitemap };