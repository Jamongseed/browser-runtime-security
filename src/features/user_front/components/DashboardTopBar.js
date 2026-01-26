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
    setDateValue(newValue);
    updateDashboardPeriod(newValue);
  };
  return (
    <div className="flex justify-end items-center w-full gap-3">
      {/* gap-3을 통해 라벨과 데이트피커 사이의 간격을 벌립니다. */}

      <span className="text-base font-semibold whitespace-nowrap text-base-content">
        {/* text-base로 크기를 키우고 font-semibold로 강조했습니다. */}
        탐지기간:
      </span>

      <div className="inline-block">
        <Datepicker
          containerClassName="w-72 relative"
          value={dateValue}
          theme={"light"}
          inputClassName="input input-bordered input-sm w-72 h-[38px] min-h-[38px] block"
          popoverDirection={"down"}
          toggleClassName="invisible absolute"
          onChange={handleDatePickerValueChange}
          showShortcuts={true}
          primaryColor={"white"}
        />
      </div>
    </div>
  );
}

export default DashboardTopBar;
