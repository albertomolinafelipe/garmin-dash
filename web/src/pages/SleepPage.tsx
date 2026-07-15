import { useQuery } from "@tanstack/react-query";
import { Card, Center, Loader, Table, Text, Title } from "@mantine/core";
import { BarChart } from "@mantine/charts";

import { api } from "../api/client";
import { fmtDuration } from "../format";
import { chartColors } from "../theme";

export default function SleepPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sleep"],
    queryFn: () => api.listSleep({ limit: 200 }),
  });

  if (isLoading)
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );

  const sleep = data ?? [];

  // Chart: last 14 nights, oldest → newest, stacked stages in hours.
  const chartData = [...sleep]
    .slice(0, 14)
    .reverse()
    .map((s) => ({
      date: s.calendar_date.slice(5),
      Deep: +((s.deep_sleep_s ?? 0) / 3600).toFixed(2),
      Light: +((s.light_sleep_s ?? 0) / 3600).toFixed(2),
      REM: +((s.rem_sleep_s ?? 0) / 3600).toFixed(2),
      Awake: +((s.awake_s ?? 0) / 3600).toFixed(2),
    }));

  return (
    <>
      <Title order={3} mb="md">
        Sleep
      </Title>

      {chartData.length > 0 && (
        <Card withBorder mb="md">
          <Text fw={500} mb="sm">
            Sleep stages (last {chartData.length} nights, hours)
          </Text>
          <BarChart
            h={240}
            data={chartData}
            dataKey="date"
            type="stacked"
            series={[
              { name: "Deep", color: chartColors.deep },
              { name: "Light", color: chartColors.light },
              { name: "REM", color: chartColors.rem },
              { name: "Awake", color: chartColors.awake },
            ]}
          />
        </Card>
      )}

      <Card withBorder padding={0} className="table-panel">
        <Table
          className="grafana-table"
          highlightOnHover
          stickyHeader
          borderColor="var(--mantine-color-dark-5)"
          verticalSpacing="sm"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Deep</Table.Th>
              <Table.Th>REM</Table.Th>
              <Table.Th>Score</Table.Th>
              <Table.Th>Resting HR</Table.Th>
              <Table.Th>HRV</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sleep.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.calendar_date}</Table.Td>
                <Table.Td>{fmtDuration(s.total_sleep_s)}</Table.Td>
                <Table.Td>{fmtDuration(s.deep_sleep_s)}</Table.Td>
                <Table.Td>{fmtDuration(s.rem_sleep_s)}</Table.Td>
                <Table.Td>{s.sleep_score ?? "—"}</Table.Td>
                <Table.Td>{s.resting_hr ?? "—"}</Table.Td>
                <Table.Td>{s.avg_hrv ?? "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {sleep.length === 0 && (
          <Text c="dimmed" ta="center" p="xl">
            No sleep data yet — hit <b>Sync</b> to pull from Garmin.
          </Text>
        )}
      </Card>
    </>
  );
}
