import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  Center,
  Loader,
  Modal,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BarChart } from "@mantine/charts";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

import { api } from "../api/client";
import { queryClient } from "../queryClient";
import type { Annotation, Sleep } from "../api/types";
import { fmtDuration } from "../format";
import AnnotationForm from "../components/AnnotationForm";
import { chartColors } from "../theme";

export default function SleepPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [selected, setSelected] = useState<Sleep | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sleep"],
    queryFn: () => api.listSleep({ limit: 200 }),
  });

  const save = useMutation({
    mutationFn: (body: Annotation) => api.updateSleep(selected!.id, body),
    onSuccess: () => {
      notifications.show({ message: "Saved", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["sleep"] });
      close();
    },
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

      <Card withBorder padding={0}>
        <Table highlightOnHover striped stickyHeader>
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
              <Table.Tr
                key={s.id}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setSelected(s);
                  open();
                }}
              >
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

      <Modal
        opened={opened}
        onClose={close}
        title={selected ? `Sleep — ${selected.calendar_date}` : ""}
      >
        {selected && (
          <AnnotationForm
            initial={selected}
            saving={save.isPending}
            onSave={(v) => save.mutate(v)}
          />
        )}
      </Modal>
    </>
  );
}
