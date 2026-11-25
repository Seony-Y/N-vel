import { Notice } from "@/components/Notice";

export default function NotFound() {
  return <Notice icon="🔍" title="찾을 수 없는 화면이에요" text="주소가 바뀌었거나, 비공개이거나, 지워진 사건일 수 있어요." />;
}
