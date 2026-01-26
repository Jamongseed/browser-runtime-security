import SelectBox from "../../../components/Input/SelectBox";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import ShareIcon from "@heroicons/react/24/outline/ShareIcon";
import EnvelopeIcon from "@heroicons/react/24/outline/EnvelopeIcon";
import EllipsisVerticalIcon from "@heroicons/react/24/outline/EllipsisVerticalIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import { useState } from "react";
import Datepicker from "react-tailwindcss-datepicker";
import moment from "moment";

const periodOptions = [
  { name: "Today", value: "TODAY" },
  { name: "Yesterday", value: "YESTERDAY" },
  { name: "This Week", value: "THIS_WEEK" },
  { name: "Last Week", value: "LAST_WEEK" },
  { name: "This Month", value: "THIS_MONTH" },
  { name: "Last Month", value: "LAST_MONTH" },
];

function DashboardTopBar({ updateDashboardPeriod }) {
  const [dateValue, setDateValue] = useState({
    startDate: moment().subtract(14, "days").toDate(),
    endDate: new Date(),
  });

  const handleDatePickerValueChange = (newValue) => {
    //console.log("newValue:", newValue);
    setDateValue(newValue);
    updateDashboardPeriod(newValue);
  };

  return (
    <div className="inline-block">
      <Datepicker
        containerClassName="w-72 relative"
        value={dateValue}
        theme={"light"}
        /* ✅ h-[38px]를 주되, 옆의 투명 버튼 영향을 안 받도록 block 설정 */
        inputClassName="input input-bordered input-sm w-72 h-[38px] min-h-[38px] block"
        popoverDirection={"down"}
        toggleClassName="invisible absolute" /* ✅ 버튼을 absolute로 빼서 공간 차지 방지 */
        onChange={handleDatePickerValueChange}
        showShortcuts={true}
        primaryColor={"white"}
      />
    </div>
  );
}

export default DashboardTopBar;
