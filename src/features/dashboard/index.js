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
import { getServerity, getDomain } from '../aws/AwsSearch'

function Dashboard(){

    const dispatch = useDispatch() 

    const updateDashboardPeriod = (newRange) => {
        // Dashboard range changed, write code to refresh your values
        dispatch(showNotification({message : `Period updated to ${newRange.startDate} to ${newRange.endDate}`, status : 1}))
    }

    const [domainData, setDomainData] = useState(null);
    
        // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
        useEffect(() => {
            // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
            getDomain("").then(res => {
                setDomainData(res);
            });
        }, []); // 처음 한 번만 실행

    const [severityData, setseverityData] = useState(null);
    
        // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
        useEffect(() => {
            // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
            // 임시 데이터
            getServerity("ORG", "2026-01-10").then(res => {
                setseverityData(res);
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
                        label={severityData.labels} 
                    />
                ) : (
                    <div>차트 로딩 중...</div>
                )}
 
                {domainData?.labels ? (
                    <BarChart 
                        title="도메인별 트랜드" 
                        labels={domainData.labels}
                    />
                ) : (
                    <div>차트 로딩 중...</div>
                )}
            </div>
            
        {/** ---------------------- Different stats content 2 ------------------------- */}
        
            <div className="grid lg:grid-cols-2 mt-10 grid-cols-1 gap-6">
                <AmountStats />
                <PageStats />
            </div>

        {/** ---------------------- User source channels table  ------------------------- */}
        
            <div className="grid lg:grid-cols-2 mt-4 grid-cols-1 gap-6">
                <UserChannels />
                <DoughnutChart />
            </div>
        </>
    )
}

export default Dashboard