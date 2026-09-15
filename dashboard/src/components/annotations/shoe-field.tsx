import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AnnotationInput } from "@/lib/annotations";
import { useShoes } from "@/lib/shoes";
import { Field } from "./fields";

// Which shoe an activity was run in. Shown for running, hiking and skiing;
// required (a red hint) once past the shoe cutoff.
export function ShoeField({
	activity,
	onSave,
	required = false,
}: {
	activity: { shoe_id: number | string | null };
	onSave: (patch: AnnotationInput) => unknown;
	required?: boolean;
}) {
	const shoes = useShoes();
	const value = activity.shoe_id == null ? "" : String(activity.shoe_id);
	return (
		<Field
			label="Shoe"
			error={
				required && activity.shoe_id == null
					? "Pick the shoe you used."
					: undefined
			}
		>
			<Select
				value={value}
				onValueChange={(next) =>
					void onSave({ shoe_id: next ? Number(next) : null })
				}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Choose a shoe" />
				</SelectTrigger>
				<SelectContent>
					{shoes.data?.shoes.map((shoe) => (
						<SelectItem key={String(shoe.id)} value={String(shoe.id)}>
							{shoe.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}
