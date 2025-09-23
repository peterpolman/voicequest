import styles from "../styles/AudioRPG.module.css";

interface InventoryPopupProps {
  isVisible: boolean;
  onClose: () => void;
  inventory: Record<string, number>;
  language: "en" | "nl";
}

export default function InventoryPopup({
  isVisible,
  onClose,
  inventory,
  language,
}: InventoryPopupProps) {
  if (!isVisible) return null;

  const titles = {
    en: "Inventory",
    nl: "Inventaris",
  };

  const emptyMessages = {
    en: "Your inventory is empty",
    nl: "Je inventaris is leeg",
  };

  const itemCount = Object.keys(inventory).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <h2>{titles[language]}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.popupContent}>
          {itemCount === 0 ? (
            <p className={styles.emptyInventory}>{emptyMessages[language]}</p>
          ) : (
            <div className={styles.inventoryList}>
              {Object.entries(inventory).map(([item, quantity]) => (
                <div key={item} className={styles.inventoryItem}>
                  <span className={styles.itemName}>{item}</span>
                  <span className={styles.itemQuantity}>×{quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
