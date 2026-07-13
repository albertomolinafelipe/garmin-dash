import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Center, Loader, Table, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { fmtDate, fmtDistance, fmtDuration } from "../format";
import { needsAnnotation } from "../activityTypes";
import ActivityTypeLabel from "../components/ActivityTypeLabel";

export default function ActivitiesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.listActivities({ limit: 200 }),
  });

  if (isLoading)
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );

  const activities = data ?? [];

  return (
    <>
      <Title order={3} mb="md">
        Activities
      </Title>
      <Card withBorder padding={0}>
        <Table highlightOnHover striped stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Distance</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Avg HR</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {activities.map((a) => (
              <Table.Tr
                key={a.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/activities/${a.id}`)}
              >
                <Table.Td>{fmtDate(a.start_time)}</Table.Td>
                <Table.Td>{a.name ?? "—"}</Table.Td>
                <Table.Td>
                  <ActivityTypeLabel activity={a} />
                </Table.Td>
                <Table.Td>{fmtDistance(a.distance_m)}</Table.Td>
                <Table.Td>{fmtDuration(a.duration_s)}</Table.Td>
                <Table.Td>{a.avg_hr ?? "—"}</Table.Td>
                <Table.Td>
                  {needsAnnotation(a) ? (
                    <Badge color="orange" variant="light">
                      needs annotation
                    </Badge>
                  ) : (
                    ""
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {activities.length === 0 && (
          <Text c="dimmed" ta="center" p="xl">
            No activities yet — hit <b>Sync</b> to pull from Garmin.
          </Text>
        )}
      </Card>
    </>
  );
}
