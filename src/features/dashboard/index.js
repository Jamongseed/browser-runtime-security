import DashboardStats from './components/DashboardStats'
import AmountStats from './components/AmountStats'
import PageStats from './components/PageStats'

import UserGroupIcon  from '@heroicons/react/24/outline/UserGroupIcon'
import UsersIcon  from '@heroicons/react/24/outline/UsersIcon'
import CircleStackIcon  from '@heroicons/react/24/outline/CircleStackIcon'
import CreditCardIcon  from '@heroicons/react/24/outline/CreditCardIcon'
import UserChannels from './components/UserChannels'
import LineChart from './components/LineChart'
import BarChart from './components/BarChart'
import DashboardTopBar from './components/DashboardTopBar'
import { useDispatch } from 'react-redux'
import {showNotification} from '../common/headerSlice'
import DoughnutChart from './components/DoughnutChart'
import { useEffect, useState } from 'react'
import { getServerity, getDomain, getHighSeverityEvents } from '../aws/AwsSearch'
import TitleCard from "../../components/Cards/TitleCard"

function Dashboard(){

    const dispatch = useDispatch() 
    const startDay = "2026-01-01"
    const endDay = "2026-01-30"

    const updateDashboardPeriod = (newRange) => {
        // Dashboard range changed, write code to refresh your values
        dispatch(showNotification({message : `Period updated to ${newRange.startDate} to ${newRange.endDate}`, status : 1}))
    }

    const [severityData, setseverityData] = useState(null);
    
        // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
        useEffect(() => {
            // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
            // 임시 데이터
            getServerity( { startDay, endDay }).then(res => {
                setseverityData(res);
            });
        }, []); // 처음 한 번만 실행

    const [domainData, setDomainData] = useState(null);
    
        // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
        
        useEffect(() => {
            // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
            getDomain( { startDay, endDay }).then(res => {
                console.log("도메인");
                console.log(res);
                setDomainData(res);
            });
        }, []); // 처음 한 번만 실행

  const [highServerityData, sethighServerityData] = useState(null);
    
        // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
        useEffect(() => {
            // getAllEvents() 함수를 실행해서 나온 결과를 recentData에 넣습니다.
            getHighSeverityEvents("2026-01-01", "2026-01-30").then(res => {
                sethighServerityData(res);
            });
        }, []); // 처음 한 번만 실행

    return(
        <>
        {/** ---------------------- Select Period Content ------------------------- */}
            <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod}/>
        
        {/** ---------------------- Different stats content 1 ------------------------- */}

        {/** ---------------------- Different charts ------------------------- */}
            <div className="grid lg:grid-cols-2 mt-0 grid-cols-1 gap-6">
                {severityData?.labels ? (
                    <BarChart
                        title="위험도별 분포" 
                        chartData={severityData}
                    />
                ) : (
                    <div>차트 로딩 중...</div>
                )}
 
                {domainData?.labels ? (
                    <BarChart 
                        title="도메인별 트랜드" 
                        chartData={domainData}
                    />
                ) : (
                    <div>차트 로딩 중...</div>
                )}
            </div>
    
        {/** ---------------------- Different stats content 2 ------------------------- */}
        {
            <div className="grid lg:grid-cols-2 mt-10 grid-cols-1 gap-6">
            <div className="overflow-x-auto w-full">
                <table className="table w-full">
                    <thead>
                    <tr>
                        <th>EventId</th>
                        <th>Serverity</th>
                        <th>Score Delta</th>
                        <th>Domain</th>
                        <th>installId</th>
                    </tr>
                    </thead>
                    <tbody>
                        {
                            highServerityData.map((l, k) => {
                                return(
                                    <tr key={k}>
                                    <td>
                                        <div className="flex items-center space-x-3">
                                            <div className="avatar">
                                                {l.eventId}
                                            </div>
                                            <div>
                                                <div className="font-bold">{l.serverity}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{l.scoreDelta}</td>
                                    <td>{l.domain}</td>
                                    <td>{l.installId}</td>
                                    </tr>
                                )
                            })
                        }
                    </tbody>
                </table>
            </div>
            </div>
}
        {/** ---------------------- User source channels table  ------------------------- */}
        
            <div className="grid lg:grid-cols-2 mt-4 grid-cols-1 gap-6">
                <AmountStats />
                <PageStats />
                <UserChannels />
                <DoughnutChart />
            </div>
        </>
    )
}

export default Dashboard