// Produktkarte eines Suchresultats mit Mengenfeld und "In den Warenkorb".

import { useState } from 'react'
import styles from '../webshop.module.css'
import { MAX_LINE_QUANTITY } from '../../../lib/shop-rules.ts'
import { formatChf, productImageUrl } from '../shared/tool-result.ts'
import type { SearchProductItem } from '../shared/tool-result.ts'

function CartIcon() {
  return (
    <svg
      className={styles.cartIconSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

export function ProductCard({
  product,
  disabled,
  onAdd,
}: {
  product: SearchProductItem
  disabled: boolean
  onAdd: (articleNumber: string, quantity: number) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const image = productImageUrl(product.celumId)
  const unitLine = [
    product.unitText,
    product.sellAmount && product.sellUnit
      ? `${product.sellAmount} ${product.sellUnit}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className={styles.cardWrap}>
      <div className={styles.imageCol}>
        <div className={styles.imageWrap}>
          {image ? (
            <img className={styles.image} src={image} alt="" loading="lazy" />
          ) : null}
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.badgeRow}>
          <span className={styles.articlePill} title="Artikelnummer">
            {product.articleNumber}
          </span>
        </div>
        {product.brand ? (
          <div className={styles.brand}>{product.brand}</div>
        ) : null}
        <h3 className={styles.title}>{product.description}</h3>
        {unitLine ? <div className={styles.unitMeta}>{unitLine}</div> : null}
      </div>

      <div className={styles.cardRight}>
        <div className={styles.cardPriceBlock}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatChf(product.price)}</span>
          </div>
        </div>
        <div className={styles.cardRightBottom}>
          <label
            className={styles.qtyRow}
            htmlFor={`qty-${product.articleNumber}`}
          >
            <span className={styles.qtyRowLabel}>Menge</span>
            <input
              id={`qty-${product.articleNumber}`}
              className={styles.qtyInput}
              type="number"
              min={1}
              max={MAX_LINE_QUANTITY}
              step={1}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                )
              }
              disabled={disabled}
            />
          </label>
          <div className={styles.cardButtonRow}>
            <button
              type="button"
              className={styles.addCartButton}
              disabled={disabled}
              onClick={() => onAdd(product.articleNumber, quantity)}
              aria-label="In den Warenkorb"
              title="In den Warenkorb"
            >
              <CartIcon />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
