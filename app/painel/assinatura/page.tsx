import SubscriptionExperience from "@/components/subscription/SubscriptionExperience";
import styles from "./page.module.css";

export default function AssinaturaPage() {
  return (
    <div className={styles.subscriptionPage}>
      <SubscriptionExperience />
    </div>
  );
}
